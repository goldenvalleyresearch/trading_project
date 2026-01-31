# routers/portfolio.py
from __future__ import annotations

import os
import asyncio
import requests
from datetime import datetime, timezone, timedelta
from typing import Any, List, Optional, Dict, Tuple

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from core.db import get_db

router = APIRouter(tags=["Portfolio"])

REFRESH_EVERY_SEC = 35 * 60
REFRESH_CONCURRENCY = 8


# -----------------------
# Response Models
# -----------------------
class PositionsTotals(BaseModel):
    unrealized_pl_total: float
    unrealized_pl_pct_of_yday_balance: Optional[float] = None
    yday_balance: Optional[float] = None
    yday_balance_date: Optional[str] = None


class PositionsResp(BaseModel):
    data: List[PositionOut]
    as_of: str
    totals: Optional[PositionsTotals] = None


class PositionOut(BaseModel):
    ticker: str
    name: Optional[str] = None
    quantity: float

    last_price: Optional[float] = None
    market_value: Optional[float] = None

    price_as_of: Optional[datetime] = None

    # Fidelity-derived cost fields (do NOT let Polygon touch these)
    cost_value: Optional[float] = None
    avg_cost: Optional[float] = None

    # New: used by frontend for days-held (can remain None until you wire a true source)
    opened_at: Optional[datetime] = None
    days_held: Optional[int] = None  # ✅ add this

    day_change: Optional[float] = None
    day_change_pct: Optional[float] = None
    unrealized_pl: Optional[float] = None
    unrealized_pl_pct: Optional[float] = None


class PositionsResp(BaseModel):
    data: List[PositionOut]
    as_of: str


class DashboardLatestResp(BaseModel):
    snapshot_as_of: str
    total_value: float
    cash_spaxx: float
    pending_amount: float
    non_cash_positions_value: float
    todays_pnl_total: float


class LegacyPortfolioSummary(BaseModel):
    market_value: float
    cost_value: float
    pl_abs: float
    pl_pct: float
    cash: float
    invested_pct: float
    snapshot_as_of: str


class EquityPoint(BaseModel):
    date: str  # YYYY-MM-DD
    balance: float


class EquityCurveResp(BaseModel):
    series: List[EquityPoint]
    count: int
    as_of: str
    mode: str


# -----------------------
# Helpers
# -----------------------
async def _yday_balance_for_asof(as_of: str) -> tuple[Optional[float], Optional[str]]:
    """
    Return (balance, date) from performance_daily for the most recent row with date <= as_of.
    """
    db = get_db()
    perf = db["performance_daily"]

    doc = await perf.find_one(
        {"date": {"$lte": as_of}},
        projection={"_id": 0, "date": 1, "balance": 1},
        sort=[("date", -1)],
    )

    if not doc:
        return None, None

    bal = doc.get("balance")
    d = str(doc.get("date") or "")[:10]
    if not isinstance(bal, (int, float)):
        return None, d if d else None

    return float(bal), (d if d else None)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_aware_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None or not isinstance(dt, datetime):
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _coerce_float(x: Any, default: float = 0.0) -> float:
    try:
        v = float(x)
        if v != v:
            return default
        return v
    except Exception:
        return default


def _positions_list(doc: dict) -> list:
    arr = doc.get("positions")
    if isinstance(arr, list):
        return arr
    arr = doc.get("data")
    return arr if isinstance(arr, list) else []


def _position_value(p: dict) -> float:
    """
    Fidelity exports may name the 'current value' field differently depending on the ingest.
    We normalize it here.
    """
    return _coerce_float(
        p.get("market_value", None)
        if p.get("market_value", None) is not None
        else (
            p.get("value", None)
            if p.get("value", None) is not None
            else (
                p.get("current_value", None)
                if p.get("current_value", None) is not None
                else p.get("currentValue", 0.0)
            )
        ),
        0.0,
    )


def _is_cash_like_ticker(t: str) -> bool:
    t = (t or "").upper().strip()
    return bool(t) and t.endswith("**")


def _extract_pending_amount(doc: dict) -> float:
    """
    Prefer doc.pending_amount if set.
    Otherwise, find the 'Pending activity' row inside positions (often has blank ticker/symbol).
    """
    v = doc.get("pending_amount", None)
    if isinstance(v, (int, float)):
        return float(v)

    pending = 0.0
    for p in _positions_list(doc):
        if not isinstance(p, dict):
            continue

        desc = str(
            p.get("description")
            or p.get("desc")
            or p.get("name")
            or ""
        ).lower()

        if "pending" in desc:
            pending += _position_value(p)

    return float(pending)


def _parse_iso_date(d: str) -> Optional[datetime]:
    try:
        if not d or len(d) < 10:
            return None
        dt = datetime.fromisoformat(d[:10])
        return dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None

from typing import Dict, Iterable, Optional, Set
from datetime import datetime

async def _opened_at_map_from_activity_trades(
    *,
    start_date: str = "2025-01-01",
    end_date: Optional[str] = None,                 # ✅ only consider trades up to snapshot as_of
    only_tickers: Optional[Iterable[str]] = None,   # ✅ only compute for tickers in the snapshot
) -> Dict[str, datetime]:
    """
    Builds {TICKER -> opened_at} using activity_trades.

    Key behavior:
    - opened_at is the most recent date where position goes from 0 -> >0 (within the window)
    - SELLs that would make qty negative (because position existed before start_date) are ignored
      so we don't invent a fake "close" then a fake "re-open".
    - If end_date is provided, we only use trades <= end_date (so opened_at/days_held match snapshot as_of).
    """

    db = get_db()
    col = db["activity_trades"]

    ticker_filter: Optional[Set[str]] = None
    if only_tickers is not None:
        ticker_filter = {str(t or "").upper().strip() for t in only_tickers if str(t or "").strip()}
        ticker_filter = {t for t in ticker_filter if t and not _is_cash_like_ticker(t)}
        if not ticker_filter:
            return {}

    q: dict = {"trade_date": {"$gte": start_date}}
    if end_date:
        q["trade_date"]["$lte"] = end_date
    if ticker_filter is not None:
        q["ticker"] = {"$in": sorted(ticker_filter)}

    cur = (
        col.find(
            q,
            projection={"_id": 0, "ticker": 1, "side": 1, "qty": 1, "trade_date": 1, "created_at": 1},
        )
        .sort([("trade_date", 1), ("created_at", 1)])  # stable ordering within a day
    )

    rows = await cur.to_list(length=200000)

    pos_qty: Dict[str, float] = {}
    opened_at: Dict[str, datetime] = {}

    for r in rows:
        t = str(r.get("ticker") or "").upper().strip()
        if not t or _is_cash_like_ticker(t):
            continue
        if ticker_filter is not None and t not in ticker_filter:
            continue

        side = str(r.get("side") or "").upper().strip()
        if side not in ("BUY", "SELL"):
            continue

        dt = _parse_iso_date(str(r.get("trade_date") or ""))
        if dt is None:
            continue

        try:
            qty = abs(float(r.get("qty") or 0.0))
        except Exception:
            qty = 0.0
        if qty <= 0:
            continue

        prev = float(pos_qty.get(t, 0.0))

        if side == "BUY":
            new = prev + qty
            pos_qty[t] = new

            # record open when we cross from 0 -> positive
            if prev <= 0.0 and new > 0.0:
                opened_at[t] = dt

        else:  # SELL
            # ✅ critical: if we don't know baseline and we're at 0, ignore sells (don't go negative)
            if prev <= 0.0:
                pos_qty[t] = 0.0
                continue

            new = prev - qty
            if new < 1e-9:
                new = 0.0
            pos_qty[t] = new

            # if fully closed, remove open marker (next BUY will re-open)
            if new == 0.0 and t in opened_at:
                del opened_at[t]

    return opened_at


def _snapshot_net_value(doc: dict) -> float:
    """
    Snapshot truth:
    sum(all position values INCLUDING SPAXX** cash position)
    + pending activity (can be negative)
    """
    total = 0.0
    for p in _positions_list(doc):
        if not isinstance(p, dict):
            continue
        total += _position_value(p)

    total += _extract_pending_amount(doc)
    return float(total)


async def _latest_snapshot_doc() -> dict:
    db = get_db()
    col = db["snapshots"]
    doc = await col.find_one({}, sort=[("as_of", -1)], projection={"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="No snapshots found")
    return doc


async def _snapshot_doc_for(as_of: str) -> dict:
    db = get_db()
    col = db["snapshots"]
    doc = await col.find_one({"as_of": as_of}, projection={"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Snapshot not found for as_of={as_of}")
    return doc


def _requests_get_json(url: str, params: dict, timeout: int = 15) -> Tuple[int, dict, str]:
    try:
        r = requests.get(url, params=params, timeout=timeout)
        status = r.status_code
        text_preview = (r.text or "")[:400]
        try:
            data = r.json()
        except Exception:
            data = {}
        return status, data, text_preview
    except Exception as e:
        return 599, {}, f"{type(e).__name__}: {e}"


async def _polygon_last_trade_price(ticker: str, api_key: str) -> Optional[float]:
    url = f"https://api.polygon.io/v2/last/trade/{ticker}"
    params = {"apiKey": api_key}
    status, j, _ = await asyncio.to_thread(_requests_get_json, url, params, 15)
    if status == 404:
        return None
    last = j.get("last") or {}
    p = last.get("p")
    return float(p) if p is not None else None


async def _polygon_prev_close(ticker: str, api_key: str) -> Optional[float]:
    url = f"https://api.polygon.io/v2/aggs/ticker/{ticker}/prev"
    params = {"adjusted": "true", "apiKey": api_key}
    status, j, _ = await asyncio.to_thread(_requests_get_json, url, params, 15)
    if status == 404:
        return None
    results = j.get("results") or []
    if not results:
        return None
    c = results[0].get("c")
    return float(c) if c is not None else None


async def _get_any_price(ticker: str, api_key: str) -> Optional[float]:
    p = await _polygon_last_trade_price(ticker, api_key)
    if p is not None:
        return p
    return await _polygon_prev_close(ticker, api_key)


async def _latest_prices_timestamp() -> Optional[datetime]:
    db = get_db()
    meta = db["prices_meta"]
    doc = await meta.find_one({"_id": "latest"}, projection={"_id": 0, "as_of": 1})
    return _as_aware_utc(doc.get("as_of") if doc else None)


async def _latest_snapshot_tickers(limit: int = 2000) -> List[str]:
    doc = await _latest_snapshot_doc()
    tickers: list[str] = []
    for p in _positions_list(doc):
        if not isinstance(p, dict):
            continue
        t = str(p.get("ticker") or p.get("symbol") or "").upper().strip()
        if not t or _is_cash_like_ticker(t):
            continue
        tickers.append(t)
    return sorted(set(tickers))[:limit]


async def ensure_prices_fresh(
    max_age_sec: int = REFRESH_EVERY_SEC,
    limit: int = 2000,
    force: bool = False,
) -> dict:
    api_key = os.getenv("POLYGON_API_KEY")
    if not api_key:
        return {"refreshed": False, "reason": "Missing POLYGON_API_KEY"}

    tickers = await _latest_snapshot_tickers(limit=limit)
    if not tickers:
        return {"refreshed": False, "reason": "No tickers in latest snapshot"}

    now = utcnow()

    latest_ts = await _latest_prices_timestamp()
    if not force and latest_ts is not None:
        age_sec = (now - latest_ts).total_seconds()
        if age_sec <= max_age_sec:
            return {
                "refreshed": False,
                "reason": "Fresh enough",
                "age_sec": int(age_sec),
                "total": len(tickers),
                "as_of": latest_ts,
            }

    db = get_db()
    prices_col = db["prices_latest"]
    meta_col = db["prices_meta"]

    existing = await prices_col.find(
        {"ticker": {"$in": tickers}},
        {"_id": 0, "ticker": 1, "as_of": 1},
    ).to_list(length=len(tickers) + 10)

    by_ticker: dict[str, Optional[datetime]] = {}
    for r in existing:
        t = str(r.get("ticker") or "").upper().strip()
        if not t:
            continue
        by_ticker[t] = _as_aware_utc(r.get("as_of"))

    need: list[str] = []
    for t in tickers:
        ts = by_ticker.get(t)
        if force or ts is None or (now - ts).total_seconds() > max_age_sec:
            need.append(t)

    if not need:
        await meta_col.update_one(
            {"_id": "latest"},
            {"$set": {"as_of": now}},
            upsert=True,
        )
        return {"refreshed": False, "reason": "All tickers fresh", "total": len(tickers), "as_of": now}

    updated = 0
    missing: list[str] = []
    errors: list[str] = []

    sem = asyncio.Semaphore(REFRESH_CONCURRENCY)

    async def fetch_one(t: str):
        nonlocal updated
        async with sem:
            try:
                price = await _get_any_price(t, api_key)
            except Exception as e:
                errors.append(f"{t}:{type(e).__name__}")
                return

            if price is None:
                missing.append(t)
                return

            now2 = utcnow()
            await prices_col.update_one(
                {"ticker": t},
                {
                    "$set": {"ticker": t, "price": float(price), "as_of": now2, "source": "polygon"},
                    "$setOnInsert": {"created_at": now2},
                },
                upsert=True,
            )
            updated += 1

    await asyncio.gather(*(fetch_one(t) for t in need))

    await meta_col.update_one(
        {"_id": "latest"},
        {"$set": {"as_of": now}},
        upsert=True,
    )

    return {
        "refreshed": True,
        "force": bool(force),
        "total": len(tickers),
        "attempted": len(need),
        "updated": updated,
        "missing": missing[:50],
        "errors": errors[:50],
        "as_of": now,
    }


async def _prices_map() -> Dict[str, dict]:
    db = get_db()
    col = db["prices_latest"]
    cur = col.find({}, {"_id": 0, "ticker": 1, "price": 1, "as_of": 1}).sort("as_of", -1).limit(5000)
    rows = await cur.to_list(length=5000)

    out: dict[str, dict] = {}
    for r in rows:
        t = str(r.get("ticker") or "").upper().strip()
        p = r.get("price")
        if not t or not isinstance(p, (int, float)) or t in out:
            continue
        out[t] = {"price": float(p), "as_of": _as_aware_utc(r.get("as_of"))}
    return out


def _apply_live_price(p: dict, live: dict) -> dict:
    """
    IMPORTANT: This does NOT update MongoDB snapshot data.
    It only overlays price/value fields in the API response.
    """
    out = dict(p)

    q = _coerce_float(p.get("quantity", 0.0), 0.0)
    cost_value = _coerce_float(p.get("cost_value", 0.0), 0.0)

    price = float(live["price"])
    mv = price * float(q)

    out["last_price"] = price
    out["market_value"] = float(mv)

    # compatibility aliases
    out["price"] = price
    out["value"] = float(mv)

    if cost_value:
        unreal = mv - cost_value
        out["unrealized_pl"] = float(unreal)
        out["unrealized_pl_pct"] = float(unreal / cost_value) if cost_value else 0.0

    return out


def _compute_dashboard_from_positions(
    *,
    as_of: str,
    positions: list[dict],
    cash_spaxx: float,
    pending_amount: float,
    todays_pnl_total: float,
) -> dict:
    non_cash_positions_value = 0.0
    cash_from_positions = 0.0

    for p in positions:
        t = str(p.get("ticker") or p.get("symbol") or "").upper().strip()
        if not t:
            continue

        mv = _coerce_float(p.get("market_value", 0.0), 0.0)

        if _is_cash_like_ticker(t):
            cash_from_positions += mv
            continue

        non_cash_positions_value += mv

    cash_total = float(cash_spaxx) + float(cash_from_positions)
    total_value = non_cash_positions_value + cash_total + float(pending_amount)

    return {
        "snapshot_as_of": as_of,
        "total_value": float(total_value),
        "cash_spaxx": float(cash_total),
        "pending_amount": float(pending_amount),
        "non_cash_positions_value": float(non_cash_positions_value),
        "todays_pnl_total": float(todays_pnl_total),
    }


# -----------------------
# Endpoints
# -----------------------


@router.get("/api/portfolio/positions", response_model=PositionsResp)
async def get_latest_positions(
    refresh_max_age_sec: int = Query(REFRESH_EVERY_SEC, ge=30, le=86400),
    force_refresh: bool = Query(False),
):
    # ✅ Snapshot is the single source of truth
    doc = await _latest_snapshot_doc()
    as_of = str(doc.get("as_of", ""))[:10]

    # Use the ingest timestamp (best “price as of”), fallback to as_of midnight UTC
    ingested_at = None
    src = doc.get("source") or {}
    if isinstance(src, dict):
        ingested_at = src.get("ingested_at")

    price_as_of = _as_aware_utc(ingested_at) or (_parse_iso_date(as_of) or utcnow())

    # build tickers from the snapshot positions (only non-cash, and qty > 0)
    snapshot_tickers: list[str] = []
    for p in _positions_list(doc):
        if not isinstance(p, dict):
            continue
        ticker = str(p.get("ticker") or p.get("symbol") or "").upper().strip()
        if not ticker or _is_cash_like_ticker(ticker):
            continue
        qty = _coerce_float(p.get("quantity", 0))
        if qty and qty > 0:
            snapshot_tickers.append(ticker)

    activity_opened = await _opened_at_map_from_activity_trades(
        start_date="2025-01-01",
        end_date=as_of,
        only_tickers=snapshot_tickers,
    )

    out: list[PositionOut] = []

    for p in _positions_list(doc):
        if not isinstance(p, dict):
            continue

        ticker = str(p.get("ticker") or p.get("symbol") or "").upper().strip()
        if not ticker:
            continue

        # ✅ NEVER overlay live pricing
        pp = p

        opened_src = _as_aware_utc(pp.get("opened_at")) or activity_opened.get(ticker)

        out.append(
            PositionOut(
                ticker=ticker,
                name=pp.get("name"),
                quantity=_coerce_float(pp.get("quantity", 0)),

                # ✅ take snapshot values as-is
                last_price=(None if pp.get("last_price") is None else _coerce_float(pp.get("last_price"))),
                market_value=(None if pp.get("market_value") is None else _coerce_float(pp.get("market_value"))),

                # ✅ all tickers share the same ingest timestamp
                price_as_of=price_as_of,

                cost_value=(None if pp.get("cost_value") is None else _coerce_float(pp.get("cost_value"))),
                avg_cost=(None if pp.get("avg_cost") is None else _coerce_float(pp.get("avg_cost"))),

                opened_at=opened_src,
                days_held=(int((price_as_of.date() - opened_src.date()).days) if opened_src else None),

                day_change=(None if pp.get("day_change") is None else _coerce_float(pp.get("day_change"))),
                day_change_pct=(None if pp.get("day_change_pct") is None else _coerce_float(pp.get("day_change_pct"))),
                unrealized_pl=(None if pp.get("unrealized_pl") is None else _coerce_float(pp.get("unrealized_pl"))),
                unrealized_pl_pct=(None if pp.get("unrealized_pl_pct") is None else _coerce_float(pp.get("unrealized_pl_pct"))),
            )
        )

    # ----- totals row (non-cash only) -----
    unreal_total = 0.0
    for item in out:
        t = (item.ticker or "").upper().strip()
        if not t or _is_cash_like_ticker(t):
            continue
        if isinstance(item.unrealized_pl, (int, float)):
            unreal_total += float(item.unrealized_pl)

    yday_balance, yday_date = await _yday_balance_for_asof(as_of)

    unreal_pct = None
    if isinstance(yday_balance, (int, float)) and yday_balance and yday_balance > 0:
        unreal_pct = float(unreal_total / yday_balance)

    totals = {
        "unrealized_pl_total": float(unreal_total),
        "unrealized_pl_pct_of_yday_balance": unreal_pct,
        "yday_balance": yday_balance,
        "yday_balance_date": yday_date,
    }

    return {"data": out, "as_of": as_of, "totals": totals}



@router.get("/api/history/dashboard-latest", response_model=DashboardLatestResp)
async def dashboard_latest(
    refresh_max_age_sec: int = Query(REFRESH_EVERY_SEC, ge=30, le=86400),
):
    db = get_db()
    snap_col = db["snapshots"]

    doc = await _latest_snapshot_doc()
    as_of = str(doc.get("as_of", ""))[:10]

    pending_amount = _extract_pending_amount(doc)

    last_two = (
        await snap_col.find({}, {"_id": 0})
        .sort("as_of", -1)
        .limit(2)
        .to_list(length=2)
    )
    today_doc = last_two[0] if last_two else doc
    prev_doc = last_two[1] if len(last_two) > 1 else None

    today_total = _snapshot_net_value(today_doc)
    prev_total = _snapshot_net_value(prev_doc) if prev_doc else today_total

    todays_pnl_total = float(today_total - prev_total)

    # IMPORTANT: snapshot truth only (no Polygon live pricing here)
    positions_live = _positions_list(doc)

    # Avoid double-counting cash if SPAXX** is already included as a position row
    cash_spaxx = 0.0

    dash = _compute_dashboard_from_positions(
        as_of=as_of,
        positions=positions_live,
        cash_spaxx=cash_spaxx,
        pending_amount=pending_amount,
        todays_pnl_total=todays_pnl_total,
    )

    dash["total_value"] = float(_snapshot_net_value(doc))
    return dash


@router.get("/api/history/snapshots")
async def list_snapshots(limit: int = Query(200, ge=1, le=5000)):
    db = get_db()
    col = db["snapshots"]
    cursor = col.find({}, projection={"_id": 0, "as_of": 1}).sort("as_of", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [str(d.get("as_of", ""))[:10] for d in docs if str(d.get("as_of", ""))[:10]]


@router.get("/api/history/positions")
async def positions_for_date(as_of: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$")):
    doc = await _snapshot_doc_for(as_of)
    return {"as_of": as_of, "data": _positions_list(doc)}


@router.get("/api/latest")
async def legacy_latest():
    doc = await _latest_snapshot_doc()
    return {"snapshot_as_of": str(doc.get("as_of", ""))[:10]}


@router.get("/api/portfolio/summary", response_model=LegacyPortfolioSummary)
async def legacy_portfolio_summary(
    refresh_max_age_sec: int = Query(REFRESH_EVERY_SEC, ge=30, le=86400),
):
    dash = await dashboard_latest(refresh_max_age_sec=refresh_max_age_sec)

    total_value = dash["total_value"]
    cash = dash["cash_spaxx"] + dash["pending_amount"]
    invested = dash["non_cash_positions_value"]

    pl_abs = dash["todays_pnl_total"]
    pl_pct = (pl_abs / total_value) if total_value else 0.0
    invested_pct = (invested / total_value) if total_value else 0.0

    doc = await _latest_snapshot_doc()
    cost_value = 0.0
    for p in _positions_list(doc):
        if isinstance(p, dict):
            cost_value += _coerce_float(p.get("cost_value", 0))

    return {
        "market_value": float(total_value),
        "cost_value": float(cost_value),
        "pl_abs": float(pl_abs),
        "pl_pct": float(pl_pct),
        "cash": float(cash),
        "invested_pct": float(invested_pct),
        "snapshot_as_of": dash["snapshot_as_of"],
    }
@router.get("/api/portfolio/equity-curve", response_model=EquityCurveResp)
async def legacy_equity_curve(
    window: int = Query(365, ge=1, le=20000),
    mode: str = Query("equity", pattern=r"^(equity|twr|pnl|index|voo_index|qqq_index)$"),
    refresh_max_age_sec: int = Query(REFRESH_EVERY_SEC, ge=30, le=86400),
):
    db = get_db()
    perf = db["performance_daily"]

    cur = perf.find(
        {},
        {
            "_id": 0,
            "date": 1,
            "balance": 1,
            "net_flow": 1,
            "dollar_change": 1,

            # portfolio daily return
            "pct_change": 1,
            "pct_change_ret": 1,
            "roth_ret": 1,

            # benchmark prices
            "voo_close": 1,
            "qqq_close": 1,
            "voo": 1,
            "qqq": 1,
        },
    ).sort("date", -1).limit(window)

    rows = list(reversed(await cur.to_list(length=window)))

    daily: list[dict] = []
    for r in rows:
        d = str(r.get("date", ""))[:10]
        bal = r.get("balance")
        if not (len(d) == 10 and isinstance(bal, (int, float))):
            continue

        # portfolio daily return (already decimal)
        pc = r.get("pct_change")
        if pc is None:
            pc = r.get("pct_change_ret")
        if pc is None:
            pc = r.get("roth_ret")

        # benchmark closes
        voo_close = r.get("voo_close") or r.get("voo")
        qqq_close = r.get("qqq_close") or r.get("qqq")

        daily.append({
            "date": d,
            "balance": float(bal),
            "net_flow": float(r.get("net_flow") or 0.0),
            "dollar_change": float(r["dollar_change"]) if isinstance(r.get("dollar_change"), (int, float)) else None,
            "pct_change": float(pc) if isinstance(pc, (int, float)) else None,
            "voo_close": float(voo_close) if isinstance(voo_close, (int, float)) else None,
            "qqq_close": float(qqq_close) if isinstance(qqq_close, (int, float)) else None,
        })

    # --------------------
    # INDEX / VOO_INDEX / QQQ_INDEX (SINGLE SOURCE OF TRUTH)
    # --------------------
    if mode in ("index", "voo_index", "qqq_index"):
        if not daily:
            return {"series": [], "count": 0, "as_of": "—", "mode": mode}

        idx = 100.0
        out = [{"date": daily[0]["date"], "balance": 100.0}]

        for i in range(1, len(daily)):
            prev = daily[i - 1]
            cur = daily[i]

            if mode == "index":
                ret = cur.get("pct_change")

            elif mode == "voo_index":
                p, c = prev.get("voo_close"), cur.get("voo_close")
                ret = (c - p) / p if isinstance(p, (int, float)) and isinstance(c, (int, float)) and p > 0 else 0.0

            else:  # qqq_index
                p, c = prev.get("qqq_close"), cur.get("qqq_close")
                ret = (c - p) / p if isinstance(p, (int, float)) and isinstance(c, (int, float)) and p > 0 else 0.0

            if not isinstance(ret, (int, float)):
                ret = 0.0

            idx *= (1.0 + ret)

            out.append({
                "date": cur["date"],
                "balance": round(idx, 4)
            })

        return {
            "series": out,
            "count": len(out),
            "as_of": out[-1]["date"],
            "mode": mode
        }

    # --------------------
    # EQUITY (RAW BALANCE)
    # --------------------
    if mode == "equity":
        series = [{"date": r["date"], "balance": r["balance"]} for r in daily]
        return {"series": series, "count": len(series), "as_of": series[-1]["date"] if series else "—", "mode": mode}

    # --------------------
    # PNL (CONTRIBUTION NEUTRAL)
    # --------------------
    if mode == "pnl":
        running = 0.0
        out = []
        for r in daily:
            if isinstance(r.get("dollar_change"), (int, float)):
                running += r["dollar_change"]
            out.append({"date": r["date"], "balance": round(running, 2)})

        return {"series": out, "count": len(out), "as_of": out[-1]["date"] if out else "—", "mode": mode}

    # --------------------
    # TWR
    # --------------------
    if mode == "twr":
        if not daily:
            return {"series": [], "count": 0, "as_of": "—", "mode": mode}

        idx = 100.0
        out = [{"date": daily[0]["date"], "balance": idx}]
        prev_bal = daily[0]["balance"]

        for r in daily[1:]:
            cur_bal = r["balance"]
            flow = r["net_flow"]
            ret = (cur_bal - flow - prev_bal) / prev_bal if prev_bal else 0.0
            idx *= (1.0 + ret)
            out.append({"date": r["date"], "balance": round(idx, 4)})
            prev_bal = cur_bal

        return {"series": out, "count": len(out), "as_of": out[-1]["date"], "mode": mode}




@router.get("/api/benchmark/price-series")
async def benchmark_price_series(
    symbol: str = Query("SPY"),
    range: str = Query("6M"),
    max_age_sec: int = Query(86400, ge=60, le=86400 * 30),
):
    api_key = os.getenv("POLYGON_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="POLYGON_API_KEY not configured")

    sym = (symbol or "").upper().strip()
    if not sym:
        raise HTTPException(status_code=400, detail="symbol required")

    def _range_to_days(r: str) -> int:
        r = (r or "6M").upper()
        if r == "1M": return 30
        if r == "3M": return 90
        if r == "6M": return 180
        if r == "1Y": return 365
        if r == "5Y": return 365 * 5
        return 180

    days = _range_to_days(range)

    db = get_db()
    col = db["benchmark_daily"]

    now = utcnow()

    cached = await col.find_one({"symbol": sym, "range": range.upper()}, projection={"_id": 0})
    if cached:
        cached_asof = _as_aware_utc(cached.get("as_of"))
        if cached_asof and (now - cached_asof) <= timedelta(seconds=max_age_sec):
            return {"symbol": sym, "range": range.upper(), "as_of": cached_asof, "series": cached.get("series", [])}

    end = now
    start = now - timedelta(days=days + 10)

    url = f"https://api.polygon.io/v2/aggs/ticker/{sym}/range/1/day/{start.date()}/{end.date()}"
    params = {"adjusted": "true", "sort": "asc", "limit": 5000, "apiKey": api_key}

    status, j, preview = await asyncio.to_thread(_requests_get_json, url, params, 20)

    if status == 404:
        raise HTTPException(status_code=404, detail=f"Symbol not found: {sym}")
    if status >= 400:
        raise HTTPException(status_code=502, detail=f"Polygon error {status}: {preview}")

    results = j.get("results") or []
    series = []
    for r in results:
        t = r.get("t")
        c = r.get("c")
        if t is None or c is None:
            continue
        dt = datetime.fromtimestamp(int(t) / 1000, tz=timezone.utc).date().isoformat()
        series.append({"date": dt, "close": float(c)})

    await col.update_one(
        {"symbol": sym, "range": range.upper()},
        {"$set": {"symbol": sym, "range": range.upper(), "as_of": now, "series": series}, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )

    return {"symbol": sym, "range": range.upper(), "as_of": now, "series": series}


@router.get("/api/portfolio/prices-refresh")
async def prices_refresh(
    force: bool = Query(False),
    max_age_sec: int = Query(REFRESH_EVERY_SEC, ge=30, le=86400),
):
    return await ensure_prices_fresh(max_age_sec=max_age_sec, limit=2000, force=force)
