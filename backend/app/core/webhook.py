"""Webhook signature verification (HMAC-SHA256)."""

from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any


def compute_webhook_signature(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def verify_webhook_signature(
    secret: str,
    body: bytes,
    signature_header: str | None,
) -> bool:
    if not secret:
        return True
    if not signature_header:
        return False
    expected = compute_webhook_signature(secret, body)
    provided = signature_header.removeprefix("sha256=").strip()
    return hmac.compare_digest(expected, provided)


def canonical_payload_bytes(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
