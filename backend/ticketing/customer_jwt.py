"""JWT για πελάτες My Wallet (B2C)."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from jwt import PyJWTError

DEFAULT_SECRET = "dev-customer-jwt-change-in-production"
DEFAULT_MINUTES = 60 * 24 * 7  # 7 days


def _secret() -> str:
    return (
        os.getenv("CUSTOMER_JWT_SECRET")
        or os.getenv("AUTH_JWT_SECRET")
        or DEFAULT_SECRET
    ).strip()


def _expire_minutes() -> int:
    raw = os.getenv("CUSTOMER_JWT_EXPIRE_MINUTES", "").strip()
    if raw.isdigit():
        return int(raw)
    return DEFAULT_MINUTES


def create_customer_token(email: str, extra: dict[str, Any] | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": email.strip().lower(),
        "type": "customer_access",
        "roles": ["customer"],
        "iat": now,
        "exp": now + timedelta(minutes=_expire_minutes()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, _secret(), algorithm="HS256")


def decode_customer_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, _secret(), algorithms=["HS256"])
    except PyJWTError as exc:
        raise ValueError("Invalid or expired token") from exc
    if payload.get("type") != "customer_access":
        raise ValueError("Invalid token type")
    email = str(payload.get("sub") or "").strip().lower()
    if not email:
        raise ValueError("Invalid token subject")
    return payload
