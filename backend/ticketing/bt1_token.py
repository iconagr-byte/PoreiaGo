"""Verify client-issued bt1.* HMAC tokens (offline wallet fallback)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any

PREFIX = "bt1"
_DEFAULT_DEV_SECRET = "dev-only-aerostride-ticket-secret-change-in-production"


def _is_production() -> bool:
    return (os.getenv("ENVIRONMENT") or "").strip().lower() in ("production", "prod")


def _secret() -> bytes | None:
    raw = (os.getenv("TICKET_SIGNING_SECRET") or "").strip()
    if not raw:
        if _is_production():
            return None
        raw = _DEFAULT_DEV_SECRET
    if _is_production() and (
        raw == _DEFAULT_DEV_SECRET
        or "dev-only" in raw.lower()
        or "change-in-production" in raw.lower()
        or len(raw) < 32
    ):
        return None
    return raw.encode()


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def verify_bt1_token(token: str) -> tuple[dict[str, Any] | None, str | None]:
    trimmed = (token or "").strip()
    parts = trimmed.split(".")
    if len(parts) != 3 or parts[0] != PREFIX:
        return None, "INVALID_FORMAT"

    secret = _secret()
    if secret is None:
        # Production without a strong TICKET_SIGNING_SECRET — refuse client HMAC.
        return None, "INVALID_SIGNATURE"

    try:
        payload = json.loads(_b64url_decode(parts[1]).decode())
        sig = _b64url_decode(parts[2])
        message = "|".join(
            [
                str(payload.get("v", "")),
                str(payload.get("bid", "")),
                str(payload.get("tripId", "")),
                str(payload.get("seat", "")),
                str(payload.get("exp", "")),
                str(payload.get("nonce", "")),
            ]
        )
        expected = hmac.new(secret, message.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(sig, expected):
            return None, "INVALID_SIGNATURE"
        if payload.get("exp") and int(time.time()) > int(payload["exp"]):
            return None, "EXPIRED"
        return payload, None
    except (ValueError, json.JSONDecodeError, KeyError):
        return None, "PARSE_ERROR"
