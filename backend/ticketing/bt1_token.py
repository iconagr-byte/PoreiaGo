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


def _secret() -> bytes:
    raw = os.getenv(
        "TICKET_SIGNING_SECRET",
        "dev-only-aerostride-ticket-secret-change-in-production",
    )
    return raw.encode()


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def verify_bt1_token(token: str) -> tuple[dict[str, Any] | None, str | None]:
    trimmed = (token or "").strip()
    parts = trimmed.split(".")
    if len(parts) != 3 or parts[0] != PREFIX:
        return None, "INVALID_FORMAT"

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
        expected = hmac.new(_secret(), message.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(sig, expected):
            return None, "INVALID_SIGNATURE"
        if payload.get("exp") and int(time.time()) > int(payload["exp"]):
            return None, "EXPIRED"
        return payload, None
    except (ValueError, json.JSONDecodeError, KeyError):
        return None, "PARSE_ERROR"
