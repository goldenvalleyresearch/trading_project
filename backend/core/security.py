# core/security.py
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple
from uuid import uuid4

import bcrypt
import jwt
from fastapi import HTTPException, Request, Response, status

from core.config import settings


_BCRYPT_ROUNDS = int(getattr(settings, "BCRYPT_ROUNDS", 12))


MIN_PASSWORD_LEN = int(getattr(settings, "MIN_PASSWORD_LEN", 5))


def hash_password(password: str) -> str:
    if not password or len(password) < MIN_PASSWORD_LEN:
        raise HTTPException(
            status_code=400,
            detail=f"Password must be at least {MIN_PASSWORD_LEN} characters.",
        )
    salt = bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    if not password or not password_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def _get_required_str(name: str, default: Optional[str] = None) -> str:
    v = getattr(settings, name, None)
    if isinstance(v, str) and v.strip():
        return v.strip()
    if default is not None:
        return default
    raise RuntimeError(f"Missing required setting: {name}")


JWT_SECRET = _get_required_str("JWT_SECRET", default="dev-change-me")
JWT_ALG = _get_required_str("JWT_ALG", default="HS256")

ACCESS_TTL_MIN = int(getattr(settings, "ACCESS_TOKEN_TTL_MIN", 60))
REFRESH_TTL_DAYS = int(getattr(settings, "REFRESH_TOKEN_TTL_DAYS", 14))

ACCESS_COOKIE = getattr(settings, "ACCESS_COOKIE_NAME", "access_token")
REFRESH_COOKIE = getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(
    *,
    sub: str,
    extra: Optional[Dict[str, Any]] = None,
    ttl_minutes: int = ACCESS_TTL_MIN,
) -> str:
    now = utcnow()
    payload: Dict[str, Any] = {
        "typ": "access",
        "sub": sub,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ttl_minutes)).timestamp()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def create_refresh_token(
    *,
    sub: str,
    ttl_days: int = REFRESH_TTL_DAYS,
    jti: Optional[str] = None,
) -> str:

    now = utcnow()
    payload: Dict[str, Any] = {
        "typ": "refresh",
        "sub": sub,
        "jti": jti or uuid4().hex,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=ttl_days)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def require_token_type(payload: Dict[str, Any], typ: str) -> Dict[str, Any]:
    if payload.get("typ") != typ:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Wrong token type (need {typ})",
        )
    if not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing subject")
    return payload


def _cookie_secure() -> bool:
    v = getattr(settings, "COOKIE_SECURE", False)
    if isinstance(v, bool):
        return v
    return str(v).lower() in {"1", "true", "yes", "on"}


def _cookie_samesite() -> str:
    v = str(getattr(settings, "COOKIE_SAMESITE", "lax")).lower()
    return v if v in {"lax", "strict", "none"} else "lax"


def _cookie_domain() -> Optional[str]:
    v = getattr(settings, "COOKIE_DOMAIN", None)
    if isinstance(v, str) and v.strip():
        return v.strip()
    return None


def set_auth_cookies(
    resp: Response,
    *,
    access_token: str,
    refresh_token: Optional[str] = None,
    remember: bool = True,
) -> None:

    secure = _cookie_secure()
    samesite = _cookie_samesite()
    domain = _cookie_domain()

    resp.set_cookie(
        key=ACCESS_COOKIE,
        value=access_token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/",
        domain=domain,
        max_age=ACCESS_TTL_MIN * 60,
    )


    if refresh_token is not None:
        max_age = (REFRESH_TTL_DAYS * 24 * 60 * 60) if remember else None
        resp.set_cookie(
            key=REFRESH_COOKIE,
            value=refresh_token,
            httponly=True,
            secure=secure,
            samesite=samesite,
            path="/",
            domain=domain,
            max_age=max_age,
        )


def clear_auth_cookies(resp: Response) -> None:
    domain = _cookie_domain()
    resp.delete_cookie(key=ACCESS_COOKIE, path="/", domain=domain)
    resp.delete_cookie(key=REFRESH_COOKIE, path="/", domain=domain)


def get_cookie_tokens(req: Request) -> Tuple[Optional[str], Optional[str]]:

    return req.cookies.get(ACCESS_COOKIE), req.cookies.get(REFRESH_COOKIE)


def refresh_access_from_refresh(
    refresh_token: str,
    *,
    extra: Optional[Dict[str, Any]] = None,
) -> str:
    payload = decode_token(refresh_token)
    require_token_type(payload, "refresh")
    sub = str(payload["sub"])
    return create_access_token(sub=sub, extra=extra)


def refresh_pair_from_refresh(
    refresh_token: str,
    *,
    extra: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    payload = decode_token(refresh_token)
    require_token_type(payload, "refresh")
    sub = str(payload["sub"])

    new_access = create_access_token(sub=sub, extra=extra)
    new_refresh = create_refresh_token(sub=sub)
    return new_access, new_refresh


def auth_fail(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def get_access_token_from_request(req: Request) -> Optional[str]:
    auth = req.headers.get("authorization") or req.headers.get("Authorization")
    if isinstance(auth, str):
        parts = auth.strip().split()
        if len(parts) == 2 and parts[0].lower() == "bearer" and parts[1].strip():
            return parts[1].strip()

    access_cookie, _refresh_cookie = get_cookie_tokens(req)
    return access_cookie


def require_access_payload(req: Request) -> Dict[str, Any]:
    token = get_access_token_from_request(req)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = decode_token(token)
    require_token_type(payload, "access")
    return payload