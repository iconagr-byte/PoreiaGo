"""Signed token for public rental trip share / track links."""

from __future__ import annotations

import os
import time

import jwt

JWT_SECRET = (
    os.getenv("MASTER_QR_SECRET")
    or os.getenv("TICKET_JWT_SECRET")
    or os.getenv("AUTH_JWT_SECRET")
    or "dev-jwt-secret-change-in-prod"
)
JWT_ALGORITHM = "HS256"
DEFAULT_TTL_HOURS = int(os.getenv("RENTAL_SHARE_TOKEN_TTL_HOURS", "72"))


def create_rental_share_token(
    *,
    booking_id: str,
    tenant_id: str,
    ttl_hours: int | None = None,
) -> str:
    if not JWT_SECRET:
        raise RuntimeError("JWT secret not configured")
    hours = ttl_hours if ttl_hours is not None else DEFAULT_TTL_HOURS
    bid = str(booking_id or "").strip()
    tid = str(tenant_id or "").strip()
    if not bid or not tid:
        raise ValueError("booking_id and tenant_id required")
    payload = {
        "scope": "rental_share",
        "booking_id": bid,
        "tenant_id": tid,
        "exp": int(time.time()) + max(1, hours) * 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_rental_share_token(token: str, *, booking_id: str | None = None) -> dict:
    if not JWT_SECRET:
        raise jwt.InvalidTokenError("JWT secret not configured")
    payload = jwt.decode(str(token or "").strip(), JWT_SECRET, algorithms=[JWT_ALGORITHM])
    if payload.get("scope") != "rental_share":
        raise jwt.InvalidTokenError("Invalid share token scope")
    if booking_id is not None and str(payload.get("booking_id") or "") != str(booking_id):
        raise jwt.InvalidTokenError("Booking mismatch")
    if not payload.get("booking_id") or not payload.get("tenant_id"):
        raise jwt.InvalidTokenError("Incomplete share token")
    return payload


def rental_share_expires_at(ttl_hours: int | None = None) -> str:
    from datetime import datetime, timedelta, timezone

    hours = ttl_hours if ttl_hours is not None else DEFAULT_TTL_HOURS
    return (datetime.now(timezone.utc) + timedelta(hours=max(1, hours))).isoformat()
