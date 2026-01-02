# routers/history.py
from __future__ import annotations

import asyncio
import re
from typing import Any, Optional

import requests
from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from core.config import settings
from core.db import get_db

router = APIRouter(prefix="/history", tags=["History"])

ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_POLY_CLOSE_CACHE: dict[tuple[str, str], float] = {}


class TradeLine(BaseModel):
    ticker: str
    side: str = Field(..., description="BUY/SELL")
    qty: float
    price: Optional[float] = None
    value: Optional[float] = None


class ReceiptResp(BaseModel):
    as_of: str
    receipt_id: str
    net_after: float
    net_before: Optional[float] = None
    delta: Optional[float] = None
    trades: list[TradeLine] = []


def snapshots_col(db):
    return db["snapshots"]


def _is_cash_like_ticker(t: str) -> bool:
    t = (t or "").upper().strip()
    return bool(t) and t.endswith("**")


def _float(x: Any) -> float:
    try:
        return float(x)
    except Exception:
        return 0.0


def _round_qty(q: float) -> float:
    return round(float(q), 6)


def _round_money(x: Optional[float]) -> Optional[float]:
    if x is None:
        return None
    return round(float(x), 2)


def _round_price(x: Optional[float]) -> Optional[float]:
    if x is None:
        return None
    return round(float(x), 4)


def _pos_map(doc: dict[str, Any]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for p in (doc.get("positions") or []):
        if not isinstance(p, dict):
            continue
        t = p.get("ticker") or p.get("symbol")
        if not t:
            continue
        out[str(t).upper()] = p
    return out


def compute_non_cash_value(positions: list[dict[str, Any]]) -> float:
    total = 0.0
    for p in positions:
        mv = p.get("market_value")
        if mv is None:
            mv = p.get("value")
        if isinstance(mv, (int, float)):
            total += float(mv)
    return total


def _net_value(doc: Optional[dict[str, Any]]) -> Optional[float]:
    if not doc:
        return None

    total_value = doc.get("total_value")
    if isinstance(total_value, (int, float)):
        return float(total_value)

    cash_spaxx = _float(doc.get("cash_spaxx", 0) or 0)
    pending_amount = _float(doc.get("pending_amount", 0) or 0)

    positions = doc.get("positions") or []
    if not isinstance(positions, list):
        positions = []

    non_cash_positions_value = doc.get("non_cash_positions_value")
    if not isinstance(non_cash_positions_value, (int, float)):
        non_cash_positions_value = compute_non_cash_value(positions)

    return float(cash_spaxx + pending_amount + float(non_cash_positions_value))


async def polygon_close(ticker: str, date: str) -> Optional[float]:
    api_key = getattr(settings, "POLYGON_API_KEY", None)
    if not api_key:
        return None

    tkr = ticker.upper()
    key = (tkr, date)
    if key in _POLY_CLOSE_CACHE:
        return _POLY_CLOSE_CACHE[key]

    url = f"https://api.polygon.io/v1/open-close/{tkr}/{date}"
    params = {"adjusted": "true", "apiKey": api_key}

    def _fetch() -> Optional[float]:
        try:
            r = requests.get(url, params=params, timeout=8)
            if r.status_code != 200:
                return None
            data = r.json()
            close = data.get("close")
            if isinstance(close, (int, float)):
                return float(close)
        except Exception:
            return None
        return None

    close_f = await asyncio.to_thread(_fetch)
    if close_f is not None:
        _POLY_CLOSE_CACHE[key] = close_f
    return close_f


@router.get("/receipts", response_model=list[ReceiptResp])
async def history_receipts(limit: int = Query(30, ge=1, le=365)):
    db = get_db()
    col = snapshots_col(db)

    docs = await (
        col.find({}, {"_id": 0})
        .sort("as_of", -1)
        .limit(limit)
        .to_list(length=limit)
    )

    if not docs:
        return []

    receipts: list[ReceiptResp] = []

    for i, snap in enumerate(docs):
        as_of = snap.get("as_of")
        if not isinstance(as_of, str) or not ISO_DATE_RE.match(as_of):
            continue

        prev = docs[i + 1] if i + 1 < len(docs) else None

        net_after = _net_value(snap)
        net_before = _net_value(prev)
        delta = (net_after - net_before) if (net_after is not None and net_before is not None) else None

        a = _pos_map(snap)
        b = _pos_map(prev) if prev else {}

        tickers = sorted(set(a.keys()) | set(b.keys()))
        trades: list[TradeLine] = []

        for tkr in tickers:
            if _is_cash_like_ticker(tkr):
                continue

            pa = a.get(tkr, {})
            pb = b.get(tkr, {})

            qty_now = _float(pa.get("quantity", 0) or 0)
            qty_prev = _float(pb.get("quantity", 0) or 0)
            dq = qty_now - qty_prev

            if abs(dq) < 1e-9:
                continue

            side = "BUY" if dq > 0 else "SELL"
            qty = abs(dq)

            price = pa.get("last_price", None)
            if price is None:
                price = pb.get("last_price", None)

            price_f = float(price) if isinstance(price, (int, float)) else None
            if price_f is None:
                price_f = await polygon_close(tkr, as_of)

            value_f: Optional[float] = None
            if price_f is not None:
                value_f = float(price_f) * float(qty)
            else:
                mv_now = _float(pa.get("market_value", 0) or 0)
                if mv_now == 0.0:
                    mv_now = _float(pa.get("value", 0) or 0)
                mv_prev = _float(pb.get("market_value", 0) or 0)
                if mv_prev == 0.0:
                    mv_prev = _float(pb.get("value", 0) or 0)
                if mv_now or mv_prev:
                    value_f = abs(mv_now - mv_prev)

            trades.append(
                TradeLine(
                    ticker=tkr,
                    side=side,
                    qty=_round_qty(qty),
                    price=_round_price(price_f) if price_f is not None else None,
                    value=_round_money(value_f) if value_f is not None else None,
                )
            )

        receipts.append(
            ReceiptResp(
                as_of=as_of,
                receipt_id=f"rcpt-{as_of}",
                net_after=float(net_after or 0.0),
                net_before=float(net_before) if net_before is not None else None,
                delta=_round_money(delta) if delta is not None else None,
                trades=trades,
            )
        )

    return receipts


@router.get("/events")
async def history_events(limit: int = Query(30, ge=1, le=365)):
    receipts = await history_receipts(limit=limit)
    out = []
    for r in receipts:
        out.append(
            {
                "date": r.as_of,
                "title": "Trades (derived)",
                "tag": "trades",
                "detail": r.model_dump_json(),
                "href": "",
            }
        )
    return out