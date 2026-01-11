from __future__ import annotations

import re
import asyncio
import requests
import secrets
from datetime import datetime, timezone
from typing import Literal, Optional, List, Dict, Any, Tuple

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel, Field

from core.config import settings
from core.db import get_db
from core.security import require_access_payload

router = APIRouter(prefix="/api/newsletter", tags=["Newsletter"])
admin_router = APIRouter(prefix="/api/admin/newsletter", tags=["Admin Newsletter"])

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
MAX_SUBS = 20000


class NewsletterSendItem(BaseModel):
    id: str
    mode: str
    subject: str
    sent: int = 0
    skipped: int = 0
    errors: List[str] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    text: Optional[str] = None
    html: Optional[str] = None


class NewsletterListResp(BaseModel):
    items: List[NewsletterSendItem]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _require_admin(req: Request) -> Dict[str, Any]:
    payload = require_access_payload(req)
    role = str(payload.get("role") or "").strip().lower()
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return payload


def _requests_post_json(
    url: str, headers: dict, json_body: dict, timeout: int = 20
) -> Tuple[int, dict, str]:
    try:
        r = requests.post(url, headers=headers, json=json_body, timeout=timeout)
        status = r.status_code
        text_preview = (r.text or "")[:600]
        try:
            data = r.json()
            print(data)
        except Exception:
            data = {}
        return status, data, text_preview
    except Exception as e:
        return 599, {}, f"{type(e).__name__}: {e}"


def _api_base_url() -> str:
    return (getattr(settings, "PUBLIC_API_URL", None) or "http://localhost:8000").rstrip("/")


def _make_unsub_link(token: str) -> str:
    return f"{_api_base_url()}/api/newsletter/unsubscribe?token={token}"


def _ensure_unsub_token(doc: dict) -> str:
    t = doc.get("unsubscribe_token")
    if isinstance(t, str) and t.strip():
        return t.strip()
    return secrets.token_urlsafe(32)


def _footer_with_unsub(token: str) -> str:
    link = _make_unsub_link(token)
    return (
        "\n\n---\n"
        "You are receiving this because you subscribed to Golden Valley Market Research updates.\n"
        f"Unsubscribe: {link}\n"
    )


async def _send_email_provider(*, to_email: str, subject: str, text_body: str) -> None:
    api_key = settings.BREVO_API_KEY
    from_email = settings.BREVO_FROM_EMAIL

    if not api_key or not from_email:
        raise HTTPException(
            status_code=503,
            detail="Email not configured. Set BREVO_API_KEY and BREVO_FROM_EMAIL.",
        )

    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    payload = {
        "sender": {"email": from_email, "name": "Golden Valley Market Research"},
        "to": [{"email": to_email}],
        "subject": subject,
        "textContent": text_body,
    }

    status, _data, preview = await asyncio.to_thread(
        _requests_post_json, url, headers, payload, 20
    )
    if status >= 400:
        raise HTTPException(status_code=502, detail=f"Brevo error {status}: {preview}")


class SubscribeReq(BaseModel):
    email: str


class SubscribeResp(BaseModel):
    email: str
    status: str


class UnsubscribeResp(BaseModel):
    ok: bool = True
    status: str


@router.post("/subscribe", response_model=SubscribeResp)
async def subscribe(req: SubscribeReq):
    email = (req.email or "").strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Invalid email")

    db = get_db()
    col = db["newsletter_subscribers"]
    now = utcnow()

    existing = await col.find_one(
        {"email": email},
        {"_id": 0, "unsubscribe_token": 1, "is_active": 1},
    )
    token = _ensure_unsub_token(existing or {})

    r = await col.update_one(
        {"email": email},
        {
            "$setOnInsert": {"email": email, "created_at": now},
            "$set": {
                "updated_at": now,
                "is_active": True,
                "unsubscribed_at": None,
                "unsubscribe_token": token,
            },
        },
        upsert=True,
    )

    status = "subscribed" if r.upserted_id else "already_subscribed"
    return {"email": email, "status": status}


@router.get("/unsubscribe", response_model=UnsubscribeResp)
async def unsubscribe(token: str = Query(..., min_length=10)):
    t = (token or "").strip()
    if len(t) < 10:
        raise HTTPException(status_code=400, detail="Invalid token")

    db = get_db()
    col = db["newsletter_subscribers"]
    now = utcnow()

    doc = await col.find_one(
        {"unsubscribe_token": t},
        {"_id": 0, "email": 1, "is_active": 1},
    )
    if not doc:
        return {"ok": True, "status": "unsubscribed"}

    if doc.get("is_active") is False:
        return {"ok": True, "status": "already_unsubscribed"}

    await col.update_one(
        {"unsubscribe_token": t},
        {"$set": {"is_active": False, "unsubscribed_at": now, "updated_at": now}},
    )
    return {"ok": True, "status": "unsubscribed"}


SendMode = Literal["test", "list"]


class SendReq(BaseModel):
    subject: str = Field(min_length=1, max_length=180)
    body: str = Field(min_length=1, max_length=20000)
    mode: SendMode = "list"
    test_email: Optional[str] = None


class SendResp(BaseModel):
    ok: bool = True
    sent: int = 0
    skipped: int = 0
    message: Optional[str] = None


@admin_router.post("/send", response_model=SendResp)
async def send_newsletter(req: Request, body: SendReq):
    _require_admin(req)

    subject = (body.subject or "").strip()
    msg = (body.body or "").strip()
    if not subject or not msg:
        raise HTTPException(status_code=400, detail="subject and body are required")

    db = get_db()
    col = db["newsletter_subscribers"]

    recipients: List[Dict[str, str]] = []
    skipped = 0

    if body.mode == "test":
        to = (body.test_email or "").strip().lower()
        if not to or not EMAIL_RE.match(to):
            raise HTTPException(status_code=400, detail="Valid test_email required for mode=test")

        now = utcnow()
        existing = await col.find_one({"email": to}, {"_id": 0, "unsubscribe_token": 1})
        token = _ensure_unsub_token(existing or {})
        await col.update_one(
            {"email": to},
            {
                "$setOnInsert": {"email": to, "created_at": now},
                "$set": {
                    "updated_at": now,
                    "unsubscribe_token": token,
                    "is_active": True,
                    "unsubscribed_at": None,
                },
            },
            upsert=True,
        )
        recipients = [{"email": to, "token": token}]
    else:
        cur = col.find(
            {"is_active": True},
            {"_id": 0, "email": 1, "unsubscribe_token": 1},
        ).limit(MAX_SUBS)
        docs = await cur.to_list(length=MAX_SUBS)

        now = utcnow()
        for d in docs:
            e = str(d.get("email") or "").strip().lower()
            if not EMAIL_RE.match(e):
                skipped += 1
                continue
            token = _ensure_unsub_token(d)
            recipients.append({"email": e, "token": token})
            if d.get("unsubscribe_token") != token:
                await col.update_one(
                    {"email": e},
                    {"$set": {"unsubscribe_token": token, "updated_at": now}},
                    upsert=False,
                )

    if not recipients:
        return {"ok": True, "sent": 0, "skipped": skipped, "message": "No recipients found."}

    sent = 0
    errors: List[str] = []

    for r in recipients:
        try:
            text = msg + _footer_with_unsub(r["token"])
            await _send_email_provider(to_email=r["email"], subject=subject, text_body=text)
            sent += 1
        except HTTPException as e:
            errors.append(f"{r['email']}: {getattr(e, 'detail', 'send_failed')}")
        except Exception as e:
            errors.append(f"{r['email']}: {type(e).__name__}")

    await db["newsletter_sends"].insert_one(
        {
            "mode": body.mode,
            "subject": subject,
            "text": msg,
            "html": None,
            "sent": sent,
            "skipped": skipped,
            "errors": errors[:50],
            "created_at": utcnow(),
        }
    )

    msg_out = "Sent." if not errors else f"Sent with {len(errors)} error(s)."
    return {"ok": True, "sent": sent, "skipped": skipped + len(errors), "message": msg_out}


@router.get("/sends", response_model=NewsletterListResp)
async def list_sends_public(
    limit: int = Query(75, ge=1, le=200),
    q: str = Query("", max_length=200),
):
    db = get_db()
    col = db["newsletter_sends"]

    query: Dict[str, Any] = {}
    term = (q or "").strip()
    if term:
        query = {
            "$or": [
                {"subject": {"$regex": re.escape(term), "$options": "i"}},
                {"mode": {"$regex": re.escape(term), "$options": "i"}},
                {"text": {"$regex": re.escape(term), "$options": "i"}},
                {"html": {"$regex": re.escape(term), "$options": "i"}},
            ]
        }

    cur = col.find(query).sort("created_at", -1).limit(limit)
    docs = await cur.to_list(length=limit)

    items: List[NewsletterSendItem] = []
    for d in docs:
        items.append(
            NewsletterSendItem(
                id=str(d.get("_id")),
                mode=str(d.get("mode") or ""),
                subject=str(d.get("subject") or ""),
                sent=int(d.get("sent") or 0),
                skipped=int(d.get("skipped") or 0),
                errors=list(d.get("errors") or []),
                created_at=d.get("created_at"),
                text=d.get("text"),
                html=d.get("html"),
            )
        )

    return {"items": items}


@admin_router.get("/sends", response_model=NewsletterListResp)
async def list_sends(
    req: Request,
    limit: int = Query(75, ge=1, le=200),
    q: str = Query("", max_length=200),
):
    _require_admin(req)

    db = get_db()
    col = db["newsletter_sends"]

    query: Dict[str, Any] = {}
    term = (q or "").strip()
    if term:
        query = {
            "$or": [
                {"subject": {"$regex": re.escape(term), "$options": "i"}},
                {"mode": {"$regex": re.escape(term), "$options": "i"}},
                {"text": {"$regex": re.escape(term), "$options": "i"}},
                {"html": {"$regex": re.escape(term), "$options": "i"}},
            ]
        }

    cur = col.find(query).sort("created_at", -1).limit(limit)
    docs = await cur.to_list(length=limit)

    items: List[NewsletterSendItem] = []
    for d in docs:
        items.append(
            NewsletterSendItem(
                id=str(d.get("_id")),
                mode=str(d.get("mode") or ""),
                subject=str(d.get("subject") or ""),
                sent=int(d.get("sent") or 0),
                skipped=int(d.get("skipped") or 0),
                errors=list(d.get("errors") or []),
                created_at=d.get("created_at"),
                text=d.get("text"),
                html=d.get("html"),
            )
        )

    return {"items": items}