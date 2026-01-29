# routers/closed_trades.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Query
from core.db import get_db

# Import these helpers from portfolio.py (or duplicate them)
from routers.portfolio import _parse_iso_date, _is_cash_like_ticker, _opened_at_map_from_activity_trades

router = APIRouter(tags=["ClosedTrades"])

def _coerce_float(x: Any, default: float = 0.0) -> float:
    try:
        v = float(x)
        if v != v:
            return default
        return v
    except Exception:
        return default

@router.get("/api/history/closed-trades")
async def closed_trades(
    limit: int = Query(500, ge=1, le=5000),
    start_date: str = Query("2025-01-01", pattern=r"^\d{4}-\d{2}-\d{2}$"),
):
    """
    Returns a list of fully closed positions (by day) using:
      - activity_trades SELLs grouped by (trade_date, ticker)
      - prior snapshot (as_of < trade_date) for avg_cost + prior qty
      - opened_at from activity up to the prior snapshot date (for days held)
    """

    db = get_db()
    activity = db["activity_trades"]
    snaps = db["snapshots"]

    # 1) Group SELL activity by date+ticker (sum qty, sum proceeds)
    pipeline = [
        {"$match": {"side": "SELL", "trade_date": {"$gte": start_date}}},
        {
            "$group": {
                "_id": {"trade_date": "$trade_date", "ticker": "$ticker"},
                "trade_date": {"$first": "$trade_date"},
                "ticker": {"$first": "$ticker"},
                "qty_sold": {"$sum": "$qty"},
                "proceeds": {
                    "$sum": {
                        "$cond": [
                            {"$and": [{"$ne": ["$price", None]}, {"$ne": ["$qty", None]}]},
                            {"$multiply": ["$price", "$qty"]},
                            0.0,
                        ]
                    }
                },
                "sell_count": {"$sum": 1},
            }
        },
        {"$sort": {"trade_date": -1}},
        {"$limit": int(limit)},
    ]

    sell_days = await activity.aggregate(pipeline).to_list(length=limit)

    out: List[Dict[str, Any]] = []

    for s in sell_days:
        trade_date = str(s.get("trade_date") or "")[:10]
        ticker = str(s.get("ticker") or "").upper().strip()
        if not trade_date or not ticker or _is_cash_like_ticker(ticker):
            continue

        qty_sold = _coerce_float(s.get("qty_sold"), 0.0)
        proceeds = _coerce_float(s.get("proceeds"), 0.0)
        if qty_sold <= 0:
            continue

        # 2) Find the most recent snapshot BEFORE the trade_date that includes this ticker
        prev_snap = await snaps.find_one(
            {"as_of": {"$lt": trade_date}, "positions.ticker": ticker},
            projection={"_id": 0, "as_of": 1, "positions": 1},
            sort=[("as_of", -1)],
        )
        if not prev_snap:
            continue

        prev_as_of = str(prev_snap.get("as_of") or "")[:10]
        positions = prev_snap.get("positions") or []

        prev_pos = None
        for p in positions:
            if isinstance(p, dict) and str(p.get("ticker") or "").upper().strip() == ticker:
                prev_pos = p
                break
        if not prev_pos:
            continue

        prev_qty = _coerce_float(prev_pos.get("quantity"), 0.0)
        avg_cost = _coerce_float(prev_pos.get("avg_cost"), 0.0)

        # 3) Closed-trade test: did we sell the whole position (based on prior snapshot qty)?
        # (tolerance helps with tiny rounding noise)
        tol = 1e-6
        if qty_sold + tol < prev_qty:
            # partial trim -> skip (since you want "closed positions")
            continue

        # Use prev_qty as the "closed size" (full close)
        closed_qty = prev_qty if prev_qty > 0 else qty_sold

        # Derived sell price (weighted by proceeds)
        sell_price = (proceeds / qty_sold) if qty_sold > 0 else None

        cost_basis = avg_cost * closed_qty
        pnl_dollars = proceeds - cost_basis
        pnl_pct = (pnl_dollars / cost_basis) if cost_basis > 0 else None

        # 4) opened_at / days held (use activity up to the prior snapshot date)
        opened_map = await _opened_at_map_from_activity_trades(
            start_date="2025-01-01",
            end_date=prev_as_of,          # key: before the closing day
            only_tickers=[ticker],
        )
        opened_at = opened_map.get(ticker)
        opened_date = opened_at.date().isoformat() if opened_at else None

        days_held = None
        td = _parse_iso_date(trade_date)
        if opened_at and td:
            days_held = int((td.date() - opened_at.date()).days)

        out.append(
            {
                "ticker": ticker,
                "open_date": opened_date,
                "close_date": trade_date,
                "days_held": days_held,
                "qty": float(closed_qty),
                "avg_cost": float(avg_cost) if avg_cost else None,
                "sell_price": float(sell_price) if isinstance(sell_price, (int, float)) else None,
                "proceeds": float(proceeds),
                "cost_basis": float(cost_basis),
                "pnl_dollars": float(pnl_dollars),
                "pnl_pct": float(pnl_pct) if isinstance(pnl_pct, (int, float)) else None,
                "prev_snapshot_as_of": prev_as_of,
                "sell_count": int(s.get("sell_count") or 0),
            }
        )

    # newest closes first
    out.sort(key=lambda r: (r.get("close_date") or ""), reverse=True)
    return {"data": out, "count": len(out)}
