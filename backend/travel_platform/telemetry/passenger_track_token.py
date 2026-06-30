"""Signed token for public passenger track links."""

from __future__ import annotations

import os
import time
from uuid import UUID

import jwt

JWT_SECRET = (
    os.getenv("MASTER_QR_SECRET")
    or os.getenv("TICKET_JWT_SECRET")
    or os.getenv("AUTH_JWT_SECRET")
    or "dev-jwt-secret-change-in-prod"
)
JWT_ALGORITHM = "HS256"
DEFAULT_TTL_HOURS = int(os.getenv("PASSENGER_TRACK_TOKEN_TTL_HOURS", "72"))


def create_passenger_track_token(
    *,
    trip_id: int,
    tenant_id: UUID | str,
    ttl_hours: int | None = None,
) -> str:
    if not JWT_SECRET:
        raise RuntimeError("JWT secret not configured")
    hours = ttl_hours if ttl_hours is not None else DEFAULT_TTL_HOURS
    payload = {
        "scope": "passenger_track",
        "trip_id": int(trip_id),
        "tenant_id": str(tenant_id),
        "exp": int(time.time()) + max(1, hours) * 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_passenger_track_token(token: str, *, trip_id: int) -> dict:
    if not JWT_SECRET:
        raise jwt.InvalidTokenError("JWT secret not configured")
    payload = jwt.decode(token.strip(), JWT_SECRET, algorithms=[JWT_ALGORITHM])
    if payload.get("scope") != "passenger_track":
        raise jwt.InvalidTokenError("Invalid track token scope")
    if int(payload.get("trip_id") or 0) != int(trip_id):
        raise jwt.InvalidTokenError("Trip mismatch")
    return payload
