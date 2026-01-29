# routers/activity.py
from __future__ import annotations

from typing import Any, List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta


from core.db import get_db

router = APIRouter(tags=["Activity"])


def _coerce_float(x: Any, default: float = 0.0) -> float:
    try:
        v = float(x)
        if v != v:
            return default
        return v
    except Exception:
        return default


def _norm_date(s: str) -> str:
    return str(s or "")[:10]


class ActivityRowOut(BaseModel):
    trade_date: str
    ticker: str
    side: str
    qty: float
    price: Optional[float] = None
    value: Optional[float] = None


class ActivityLatestResp(BaseModel):
    trade_date: str
    data: List[ActivityRowOut]
    count: int


@router.get("/api/history/activity/latest", response_model=ActivityLatestResp)
async def latest_activity(
    limit: int = Query(200, ge=1, le=2000),
    date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
):
    """
    Returns activity rows for:
    - `date` if provided
    - else the latest trade_date found in activity_trades
    """
    db = get_db()
    trades = db["activity_trades"]

    if date:
        trade_date = date
    else:
        latest = await trades.find_one(
            {},
            projection={"_id": 0, "trade_date": 1},
            sort=[("trade_date", -1)],
        )
        if not latest:
            return {"trade_date": "—", "data": [], "count": 0}
        trade_date = _norm_date(latest.get("trade_date"))

    rows = await trades.find(
        {"trade_date": trade_date},
        projection={"_id": 0, "trade_date": 1, "ticker": 1, "side": 1, "qty": 1, "price": 1},
    ).sort([("ticker", 1), ("side", 1)]).limit(limit).to_list(length=limit)

    out: List[ActivityRowOut] = []
    for r in rows:
        qty = _coerce_float(r.get("qty"), 0.0)
        price = r.get("price")
        price_f = float(price) if isinstance(price, (int, float)) else None
        value = (price_f * qty) if (price_f is not None) else None

        out.append(
            ActivityRowOut(
                trade_date=trade_date,
                ticker=str(r.get("ticker") or "").upper().strip(),
                side=str(r.get("side") or "").upper().strip(),
                qty=float(qty),
                price=price_f,
                value=float(value) if isinstance(value, (int, float)) else None,
            )
        )
    return {"trade_date": trade_date, "data": out, "count": len(out)}

class ActivityRecentResp(BaseModel):
    start_date: str
    end_date: str
    data: List[ActivityRowOut]
    count: int


@router.get("/api/history/activity/recent", response_model=ActivityRecentResp)
async def recent_activity(
    days: int = Query(30, ge=1, le=120),
    limit: int = Query(2000, ge=1, le=20000),
):
    """
    Returns a flat list of activity rows for the last N days (based on trade_date),
    ending at the latest trade_date in activity_trades.
    """

    db = get_db()
    trades = db["activity_trades"]

    latest = await trades.find_one(
        {},
        projection={"_id": 0, "trade_date": 1},
        sort=[("trade_date", -1)],
    )
    if not latest:
        return {"start_date": "—", "end_date": "—", "data": [], "count": 0}

    end_date = _norm_date(latest.get("trade_date"))

    # Compute start_date = end_date - (days-1)
    try:
        end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        start_dt = end_dt - timedelta(days=int(days) - 1)
        start_date = start_dt.date().isoformat()
    except Exception:
        start_date = end_date  # fallback

    rows = await trades.find(
        {"trade_date": {"$gte": start_date, "$lte": end_date}},
        projection={"_id": 0, "trade_date": 1, "ticker": 1, "side": 1, "qty": 1, "price": 1},
    ).sort([("trade_date", -1), ("ticker", 1), ("side", 1)]).limit(limit).to_list(length=limit)

    out: List[ActivityRowOut] = []
    for r in rows:
        qty = _coerce_float(r.get("qty"), 0.0)
        price = r.get("price")
        price_f = float(price) if isinstance(price, (int, float)) else None
        value = (price_f * qty) if (price_f is not None) else None

        out.append(
            ActivityRowOut(
                trade_id="",  # not used anymore, but required by your current model
                trade_date=_norm_date(r.get("trade_date")),
                ticker=str(r.get("ticker") or "").upper().strip(),
                side=str(r.get("side") or "").upper().strip(),
                qty=float(qty),
                price=price_f,
                value=float(value) if isinstance(value, (int, float)) else None,
                thesis=None,
            )
        )

    # If you want to fully remove trade_id/thesis, we should also simplify ActivityRowOut model.
    return {"start_date": start_date, "end_date": end_date, "data": out, "count": len(out)}

