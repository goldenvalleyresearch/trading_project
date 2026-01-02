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


class PositionOut(BaseModel):
    ticker: str
    name: Optional[str] = None
    quantity: float

    last_price: Optional[float] = None
    market_value: Optional[float] = None

    price_as_of: Optional[datetime] = None

    cost_value: Optional[float] = None
    avg_cost: Optional[float] = None

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


def _is_cash_like_ticker(t: str) -> bool:
    t = (t or "").upper().strip()
    return bool(t) and t.endswith("**")


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
    col = db["prices_latest"]
    doc = await col.find_one({}, sort=[("as_of", -1)], projection={"_id": 0, "as_of": 1})
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
            return {"refreshed": False, "reason": "Fresh enough", "age_sec": int(age_sec), "total": len(tickers)}

    db = get_db()
    col = db["prices_latest"]

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
            await col.update_one(
                {"ticker": t},
                {
                    "$set": {"ticker": t, "price": float(price), "as_of": now2, "source": "polygon"},
                    "$setOnInsert": {"created_at": now2},
                },
                upsert=True,
            )
            updated += 1

    await asyncio.gather(*(fetch_one(t) for t in tickers))

    return {
        "refreshed": True,
        "force": bool(force),
        "total": len(tickers),
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
    out = dict(p)

    q = _coerce_float(p.get("quantity", 0.0), 0.0)
    cost_value = _coerce_float(p.get("cost_value", 0.0), 0.0)

    price = float(live["price"])
    mv = price * float(q)

    out["last_price"] = price
    out["market_value"] = float(mv)

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
    for p in positions:
        t = str(p.get("ticker") or p.get("symbol") or "").upper().strip()
        if not t or _is_cash_like_ticker(t):
            continue
        non_cash_positions_value += _coerce_float(p.get("market_value", 0.0), 0.0)

    total_value = non_cash_positions_value + float(cash_spaxx) + float(pending_amount)

    return {
        "snapshot_as_of": as_of,
        "total_value": float(total_value),
        "cash_spaxx": float(cash_spaxx),
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
    doc = await _latest_snapshot_doc()
    as_of = str(doc.get("as_of", ""))[:10]

    await ensure_prices_fresh(max_age_sec=refresh_max_age_sec, limit=2000, force=force_refresh)

    prices = await _prices_map()

    global_ts = await _latest_prices_timestamp()
    if global_ts is None:
        global_ts = utcnow()

    out: list[PositionOut] = []
    for p in _positions_list(doc):
        if not isinstance(p, dict):
            continue

        ticker = str(p.get("ticker") or p.get("symbol") or "").upper().strip()
        if not ticker:
            continue

        pp = p
        if _is_cash_like_ticker(ticker):
            price_as_of = global_ts
        else:
            live = prices.get(ticker)
            if live is not None:
                pp = _apply_live_price(p, live)
                price_as_of = live.get("as_of") or global_ts
            else:
                price_as_of = global_ts

        out.append(
            PositionOut(
                ticker=ticker,
                name=pp.get("name"),
                quantity=_coerce_float(pp.get("quantity", 0)),
                last_price=(None if pp.get("last_price") is None else _coerce_float(pp.get("last_price"))),
                market_value=(None if pp.get("market_value") is None else _coerce_float(pp.get("market_value"))),
                price_as_of=price_as_of,
                cost_value=(None if pp.get("cost_value") is None else _coerce_float(pp.get("cost_value"))),
                avg_cost=(None if pp.get("avg_cost") is None else _coerce_float(pp.get("avg_cost"))),
                day_change=(None if pp.get("day_change") is None else _coerce_float(pp.get("day_change"))),
                day_change_pct=(None if pp.get("day_change_pct") is None else _coerce_float(pp.get("day_change_pct"))),
                unrealized_pl=(None if pp.get("unrealized_pl") is None else _coerce_float(pp.get("unrealized_pl"))),
                unrealized_pl_pct=(None if pp.get("unrealized_pl_pct") is None else _coerce_float(pp.get("unrealized_pl_pct"))),
            )
        )

    return {"data": out, "as_of": as_of}


@router.get("/api/history/dashboard-latest", response_model=DashboardLatestResp)
async def dashboard_latest(
    refresh_max_age_sec: int = Query(REFRESH_EVERY_SEC, ge=30, le=86400),
):
    doc = await _latest_snapshot_doc()
    as_of = str(doc.get("as_of", ""))[:10]

    cash_spaxx = _coerce_float(doc.get("cash_spaxx", 0))
    pending_amount = _coerce_float(doc.get("pending_amount", 0))
    todays_pnl_total = _coerce_float(doc.get("todays_pnl_total", 0))

    try:
        await ensure_prices_fresh(max_age_sec=refresh_max_age_sec, limit=2000)
    except Exception:
        pass

    prices = await _prices_map()

    positions_live: list[dict] = []
    for p in _positions_list(doc):
        if not isinstance(p, dict):
            continue
        ticker = str(p.get("ticker") or p.get("symbol") or "").upper().strip()
        if not ticker:
            continue
        pp = p
        if not _is_cash_like_ticker(ticker):
            live = prices.get(ticker)
            if live is not None:
                pp = _apply_live_price(p, live)
        positions_live.append(pp)

    return _compute_dashboard_from_positions(
        as_of=as_of,
        positions=positions_live,
        cash_spaxx=cash_spaxx,
        pending_amount=pending_amount,
        todays_pnl_total=todays_pnl_total,
    )


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
    refresh_max_age_sec: int = Query(REFRESH_EVERY_SEC, ge=30, le=86400),
):
    db = get_db()

    perf = db["performance_daily"]
    cur = perf.find({}, {"_id": 0, "date": 1, "balance": 1}).sort("date", -1).limit(window)
    rows = await cur.to_list(length=window)
    rows = list(reversed(rows))

    series: list[dict] = []
    for r in rows:
        d = str(r.get("date", ""))[:10]
        b = r.get("balance")
        if len(d) == 10 and isinstance(b, (int, float)):
            series.append({"date": d, "balance": float(b)})

    try:
        await ensure_prices_fresh(max_age_sec=refresh_max_age_sec, limit=2000)
    except Exception:
        pass

    doc = await _latest_snapshot_doc()
    prices = await _prices_map()

    cash_spaxx = _coerce_float(doc.get("cash_spaxx", 0.0), 0.0)
    pending_amount = _coerce_float(doc.get("pending_amount", 0.0), 0.0)

    live_non_cash = 0.0
    for p in _positions_list(doc):
        if not isinstance(p, dict):
            continue
        t = str(p.get("ticker") or p.get("symbol") or "").upper().strip()
        if not t or _is_cash_like_ticker(t):
            continue

        q = _coerce_float(p.get("quantity") or p.get("qty") or 0.0, 0.0)

        live = prices.get(t)
        if live is not None:
            px = _coerce_float(live.get("price"), 0.0)
        else:
            px = _coerce_float(p.get("last_price") or p.get("price") or 0.0, 0.0)

        live_non_cash += q * px

    live_total = float(live_non_cash + cash_spaxx + pending_amount)

    live_date = utcnow().date().isoformat()
    if series and series[-1]["date"] == live_date:
        series[-1]["balance"] = live_total
    else:
        series.append({"date": live_date, "balance": live_total})

    if len(series) > window:
        series = series[-window:]

    return {"series": series, "count": len(series)}


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