from __future__ import annotations

import re
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.db import get_db

router = APIRouter(prefix="/api/newsletter", tags=["Newsletter"])

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

class SubscribeReq(BaseModel):
    email: str

class SubscribeResp(BaseModel):
    email: str
    status: str

@router.post("/subscribe", response_model=SubscribeResp)
async def subscribe(req: SubscribeReq):
    email = req.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Invalid email")

    db = get_db()
    col = db["newsletter_subscribers"]

    now = datetime.utcnow().isoformat()
    r = await col.update_one(
        {"email": email},
        {"$setOnInsert": {"email": email, "created_at": now}, "$set": {"updated_at": now}},
        upsert=True,
    )

    status = "subscribed" if r.upserted_id else "already_subscribed"
    return {"email": email, "status": status}