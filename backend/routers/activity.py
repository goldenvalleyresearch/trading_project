# routers/activity.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

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


def _make_trade_id(row: dict) -> str:
    """
    Deterministic ID so the same trade row always maps to the same thesis.
    If your ingest already stores a unique trade_id, use that instead.
    """
    d = _norm_date(row.get("trade_date"))
    t = str(row.get("ticker") or "").upper().strip()
    side = str(row.get("side") or "").upper().strip()
    qty = _coerce_float(row.get("qty"), 0.0)
    price = row.get("price")
    price_f = _coerce_float(price, 0.0) if price is not None else 0.0
    # include created_at if you want uniqueness for duplicates; but keep stable if possible
    return f"{d}|{t}|{side}|{qty:g}|{price_f:g}"


class ActivityRowOut(BaseModel):
    trade_id: str
    trade_date: str
    ticker: str
    side: str
    qty: float
    price: Optional[float] = None
    value: Optional[float] = None
    thesis: Optional[str] = None


class ActivityLatestResp(BaseModel):
    trade_date: str
    data: List[ActivityRowOut]
    count: int


class SaveThesisIn(BaseModel):
    trade_id: str = Field(..., min_length=3)
    thesis: str = Field(..., min_length=1, max_length=2000)


@router.get("/api/history/activity/latest", response_model=ActivityLatestResp)
async def latest_activity(
    limit: int = Query(200, ge=1, le=2000),
    date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
):
    """
    Returns activity rows for:
    - `date` if provided
    - else the latest trade_date found in activity_trades
    Includes thesis if present (from activity_thesis collection)
    """

    db = get_db()
    trades = db["activity_trades"]
    thesis_col = db["activity_thesis"]

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

    # Build trade_ids
    trade_ids: List[str] = []
    for r in rows:
        trade_ids.append(_make_trade_id(r))

    # Load thesis for these trade_ids
    thesis_docs = await thesis_col.find(
        {"trade_id": {"$in": trade_ids}},
        projection={"_id": 0, "trade_id": 1, "thesis": 1},
    ).to_list(length=len(trade_ids) + 10)

    thesis_map = {d["trade_id"]: d.get("thesis") for d in thesis_docs if isinstance(d, dict) and d.get("trade_id")}

    out: List[ActivityRowOut] = []
    for r, tid in zip(rows, trade_ids):
        qty = _coerce_float(r.get("qty"), 0.0)
        price = r.get("price")
        price_f = float(price) if isinstance(price, (int, float)) else None
        value = (price_f * qty) if (price_f is not None) else None

        out.append(
            ActivityRowOut(
                trade_id=tid,
                trade_date=trade_date,
                ticker=str(r.get("ticker") or "").upper().strip(),
                side=str(r.get("side") or "").upper().strip(),
                qty=float(qty),
                price=price_f,
                value=float(value) if isinstance(value, (int, float)) else None,
                thesis=thesis_map.get(tid),
            )
        )

    return {"trade_date": trade_date, "data": out, "count": len(out)}


@router.post("/api/history/activity/thesis")
async def save_activity_thesis(payload: SaveThesisIn):
    """
    Save/update thesis text for a given trade_id.
    """
    db = get_db()
    thesis_col = db["activity_thesis"]

    now = datetime.now(timezone.utc)
    await thesis_col.update_one(
        {"trade_id": payload.trade_id},
        {"$set": {"trade_id": payload.trade_id, "thesis": payload.thesis, "updated_at": now},
         "$setOnInsert": {"created_at": now}},
        upsert=True,
    )

    return {"ok": True}
