"""JWT issuance and validation — HS256 (dev) or RS256 (production keys)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import jwt
from jwt import PyJWTError

from app.core.config import get_settings
from app.models.user import UserRole


class TokenError(Exception):
    pass


def _normalize_pem(value: str) -> str:
    return value.replace("\\n", "\n").strip()


def get_jwt_algorithm() -> str:
    settings = get_settings()
    if settings.auth_jwt_private_key and settings.auth_jwt_public_key:
        return "RS256"
    return settings.auth_jwt_algorithm or "HS256"


def get_jwt_signing_key() -> str:
    settings = get_settings()
    if settings.auth_jwt_private_key:
        return _normalize_pem(settings.auth_jwt_private_key)
    if not settings.auth_jwt_secret:
        raise TokenError("AUTH_JWT_SECRET is not configured")
    return settings.auth_jwt_secret


def get_jwt_verification_key() -> str:
    settings = get_settings()
    if settings.auth_jwt_public_key:
        return _normalize_pem(settings.auth_jwt_public_key)
    if not settings.auth_jwt_secret:
        raise TokenError("AUTH_JWT_SECRET is not configured")
    return settings.auth_jwt_secret


def create_access_token(
    *,
    user_id: UUID,
    tenant_id: UUID,
    roles: list[UserRole],
    mfa_verified: bool = False,
    extra: dict[str, Any] | None = None,
    expires_minutes: int | None = None,
) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    ttl = expires_minutes if expires_minutes is not None else settings.access_token_expire_minutes
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "tenant_id": str(tenant_id),
        "roles": [r.value for r in roles],
        "mfa_verified": mfa_verified,
        "iat": now,
        "exp": now + timedelta(minutes=ttl),
        "type": "access",
    }
    if settings.auth_jwt_issuer:
        payload["iss"] = settings.auth_jwt_issuer
    if extra:
        payload.update(extra)
    return jwt.encode(payload, get_jwt_signing_key(), algorithm=get_jwt_algorithm())


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, get_jwt_verification_key(), algorithms=[get_jwt_algorithm()])
    except PyJWTError as exc:
        raise TokenError("Invalid or expired token") from exc
    if payload.get("type") not in (None, "access"):
        raise TokenError("Invalid token type")
    return payload
