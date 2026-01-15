# routes/auth.py
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from bson import ObjectId

from core.db import get_db
from core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    refresh_access_from_refresh,
    decode_token,
    require_token_type,
    get_cookie_tokens,
    set_auth_cookies,
    clear_auth_cookies,
)

router = APIRouter(prefix="/api/auth", tags=["Auth"])

Role = Literal["user", "editor", "admin"]

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def norm_email(s: str) -> str:
    return (s or "").strip().lower()


def norm_user(s: str) -> str:
    return (s or "").strip()


def is_email(s: str) -> bool:
    return bool(EMAIL_RE.match((s or "").strip()))


def validate_username(u: str) -> None:
    u = (u or "").strip()
    if len(u) < 3 or len(u) > 24:
        raise HTTPException(status_code=400, detail="Username must be 3–24 characters.")
    if not re.match(r"^[A-Za-z0-9_]+$", u):
        raise HTTPException(
            status_code=400,
            detail="Username can only use letters, numbers, and underscore.",
        )


class RegisterReq(BaseModel):
    email: str
    username: str
    password: str = Field(min_length=5)
    remember: bool = True


class LoginReq(BaseModel):
    emailOrUser: str
    password: str
    remember: bool = True
    
class ChangeMyPasswordReq(BaseModel):
    current_password: str
    new_password: str = Field(min_length=5)

class AdminSetPasswordReq(BaseModel):
    userId: str
    new_password: str = Field(min_length=5)


async def _current_user_from_access(req: Request) -> dict:
    access_token = _get_access_token(req)
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_token(access_token)
    require_token_type(payload, "access")

    sub = str(payload["sub"])

    db = get_db()
    users = db["users"]
    user = await users.find_one(
        {"_id": _oid(sub)},
        {"password_hash": 1, "passwordHash": 1, "role": 1, "is_active": 1},
    )
    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Not authenticated")

    return user


def _pick_user_identifier(email_or_user: str) -> dict:
    s = (email_or_user or "").strip()
    if not s:
        return {}
    if "@" in s:
        return {"email": s.lower()}
    return {"username": s}


def _oid(sub: str) -> ObjectId:
    try:
        return ObjectId(sub)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token subject")


def _bearer_token(req: Request) -> Optional[str]:
    h = req.headers.get("authorization") or req.headers.get("Authorization")
    if not h:
        return None
    parts = h.split(" ", 1)
    if len(parts) != 2:
        return None
    if parts[0].lower() != "bearer":
        return None
    t = parts[1].strip()
    return t if t else None


def _get_access_token(req: Request) -> Optional[str]:
    t = _bearer_token(req)
    if t:
        return t
    access_cookie, _refresh_cookie = get_cookie_tokens(req)
    return access_cookie


@router.post("/register")
async def register(body: RegisterReq):
    email = norm_email(body.email)
    username = norm_user(body.username)
    password = body.password or ""

    if not email or not is_email(email):
        raise HTTPException(status_code=400, detail="Invalid email.")
    if not username:
        raise HTTPException(status_code=400, detail="Username is required.")
    validate_username(username)

    if len(password) < 5:
        raise HTTPException(status_code=400, detail="Password must be at least 5 characters.")

    db = get_db()
    users = db["users"]

    existing = await users.find_one({"$or": [{"email": email}, {"username": username}]})
    if existing:
        if existing.get("email") == email:
            raise HTTPException(status_code=409, detail="Email already in use.")
        raise HTTPException(status_code=409, detail="Username already taken.")

    pw_hash = hash_password(password)
    now = datetime.now(timezone.utc)

    doc = {
        "email": email,
        "username": username,
        "password_hash": pw_hash,
        "role": "user",
        "is_active": True,
        "created_at": now,
        "updated_at": now,
        "last_login_at": None,
    }

    ins = await users.insert_one(doc)
    sub = str(ins.inserted_id)

    access = create_access_token(sub=sub, extra={"role": doc["role"]})
    refresh = create_refresh_token(sub=sub)


    resp = JSONResponse({"ok": True, "redirect": "/portfolio", "access_token": access})

    set_auth_cookies(resp, access_token=access, refresh_token=refresh, remember=body.remember)
    return resp


@router.post("/login")
async def login(body: LoginReq):
    q = _pick_user_identifier(body.emailOrUser)
    if not q:
        raise HTTPException(status_code=400, detail="Missing email/username")

    db = get_db()
    users = db["users"]

    user = await users.find_one(q)
    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    pw_hash = user.get("password_hash") or user.get("passwordHash")
    if not isinstance(pw_hash, str) or not verify_password(body.password, pw_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    sub = str(user.get("_id"))
    role = user.get("role") or "user"

    access = create_access_token(sub=sub, extra={"role": role})
    refresh = create_refresh_token(sub=sub)

    await users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login_at": datetime.now(timezone.utc)}},
    )


    resp = JSONResponse({"ok": True, "redirect": "/portfolio", "access_token": access})


    set_auth_cookies(resp, access_token=access, refresh_token=refresh, remember=body.remember)
    return resp


@router.post("/change-password")
async def change_password(req: Request, body: ChangeMyPasswordReq):
    user = await _current_user_from_access(req)

    pw_hash = user.get("password_hash") or user.get("passwordHash")
    if not isinstance(pw_hash, str) or not verify_password(body.current_password, pw_hash):
        raise HTTPException(status_code=401, detail="Invalid current password")

    if len(body.new_password or "") < 5:
        raise HTTPException(status_code=400, detail="Password must be at least 5 characters.")

    new_hash = hash_password(body.new_password)
    now = datetime.now(timezone.utc)

    db = get_db()
    users = db["users"]
    await users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": new_hash, "updated_at": now}},
    )
    resp = JSONResponse({"ok": True})
    clear_auth_cookies(resp)
    return resp

@router.post("/admin/set-password")
async def admin_set_password(req: Request, body: AdminSetPasswordReq):
    admin = await _current_user_from_access(req)
    role = admin.get("role") or "user"
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    if len(body.new_password or "") < 5:
        raise HTTPException(status_code=400, detail="Password must be at least 5 characters.")

    try:
        target_oid = ObjectId(body.userId)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid userId")

    new_hash = hash_password(body.new_password)
    now = datetime.now(timezone.utc)

    db = get_db()
    users = db["users"]

    res = await users.update_one(
        {"_id": target_oid},
        {"$set": {"password_hash": new_hash, "updated_at": now}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    return {"ok": True}

@router.post("/logout")
async def logout_post():
    resp = JSONResponse({"ok": True})
    clear_auth_cookies(resp)
    return resp

@router.get("/logout")
async def logout_get():
    resp = JSONResponse({"ok": True})
    clear_auth_cookies(resp)
    return resp


# -----------------------------
# /me, /refresh, /session
# -----------------------------

@router.get("/me")
async def me(req: Request):
    access_token = _get_access_token(req)
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_token(access_token)
    require_token_type(payload, "access")

    sub = str(payload["sub"])

    db = get_db()
    users = db["users"]
    user = await users.find_one(
        {"_id": _oid(sub)},
        {"role": 1, "email": 1, "username": 1, "is_active": 1},
    )
    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Not authenticated")

    role = user.get("role") or "user"
    return {
        "ok": True,
        "sub": sub,
        "role": role,
        "user": {"email": user.get("email"), "username": user.get("username"), "role": role},
    }


@router.post("/refresh")
async def refresh(req: Request):

    _access_cookie, refresh_token = get_cookie_tokens(req)
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    payload = decode_token(refresh_token)
    require_token_type(payload, "refresh")
    sub = str(payload["sub"])

    db = get_db()
    users = db["users"]
    user = await users.find_one({"_id": _oid(sub)}, {"role": 1, "is_active": 1})
    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Invalid refresh")

    role = user.get("role") or "user"
    new_access = refresh_access_from_refresh(refresh_token, extra={"role": role})

    return {"ok": True, "access_token": new_access}


@router.get("/session")
async def session(req: Request):

    access_token = _get_access_token(req)
    _access_cookie, refresh_token = get_cookie_tokens(req)

    if access_token:
        try:
            payload = decode_token(access_token)
            require_token_type(payload, "access")
            return {"ok": True, "redirect": "/portfolio"}
        except HTTPException:
            pass


    if refresh_token:
        try:
            payload = decode_token(refresh_token)
            require_token_type(payload, "refresh")
            sub = str(payload["sub"])

            db = get_db()
            users = db["users"]
            user = await users.find_one({"_id": _oid(sub)}, {"role": 1, "is_active": 1})
            if not user or not user.get("is_active", True):
                return {"ok": False}

            role = user.get("role") or "user"
            new_access = refresh_access_from_refresh(refresh_token, extra={"role": role})


            return {"ok": True, "redirect": "/portfolio", "access_token": new_access}
        except HTTPException:
            pass

    return {"ok": False}