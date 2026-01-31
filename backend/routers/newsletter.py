# --- NEWSLETTER POSTS (SIMPLE + FINAL) ---

from fastapi import APIRouter, Request, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime, timezone
import re, secrets
from bson import ObjectId

from core.db import get_db
from core.security import require_access_payload

router = APIRouter(prefix="/api/newsletter", tags=["Newsletter"])
admin_router = APIRouter(prefix="/api/admin/newsletter", tags=["Admin Newsletter"])

def utcnow():
    return datetime.now(timezone.utc)

def _require_admin(req: Request):
    payload = require_access_payload(req)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

def slugify(s: str):
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    return s[:80] or secrets.token_urlsafe(6)

# ---------- MODELS ----------

PostKind = Literal["premarket", "afterhours"]

class PostCreateReq(BaseModel):
    title: str
    kind: PostKind
    content_md: str
    published: bool = True

class PostListItem(BaseModel):
    title: str
    slug: str
    kind: str
    created_at: datetime

class PostResp(PostListItem):
    content_md: str

# ---------- ADMIN CREATE ----------

@admin_router.post("/posts")
async def create_post(req: Request, body: PostCreateReq):
    _require_admin(req)

    db = get_db()
    col = db["newsletter_posts"]

    slug = slugify(body.title)
    now = utcnow()

    doc = {
        "title": body.title.strip(),
        "slug": slug,
        "kind": body.kind,
        "content_md": body.content_md,
        "published": body.published,
        "created_at": now,
    }

    await col.insert_one(doc)
    return {"ok": True, "slug": slug}

# ---------- PUBLIC LIST ----------

@router.get("/posts")
async def list_posts(
    kind: Optional[str] = Query(None),
    limit: int = Query(25, ge=1, le=100),
):
    db = get_db()
    col = db["newsletter_posts"]

    q = {"published": True}
    if kind:
        q["kind"] = kind

    docs = await col.find(q).sort("created_at", -1).limit(limit).to_list(limit)

    return {
        "items": [
            {
                "title": d["title"],
                "slug": d["slug"],
                "kind": d["kind"],
                "created_at": d["created_at"],
            }
            for d in docs
        ]
    }

# ---------- PUBLIC READ ----------

@router.get("/posts/{slug}")
async def get_post(slug: str):
    db = get_db()
    col = db["newsletter_posts"]

    d = await col.find_one({"slug": slug, "published": True})
    if not d:
        raise HTTPException(status_code=404, detail="Not found")

    return {
        "title": d["title"],
        "slug": d["slug"],
        "kind": d["kind"],
        "content_md": d["content_md"],
        "created_at": d["created_at"],
    }
