"""Encrypted platform integrations secrets (Aviationstack / Twilio).

Super-admin editable via /api/v1/platform/integrations.
Values take precedence over empty env; non-empty env still works as ops fallback.
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
import threading
from pathlib import Path
from typing import Any

try:
    from cryptography.fernet import Fernet, InvalidToken
except ImportError:  # pragma: no cover
    Fernet = None  # type: ignore
    InvalidToken = Exception  # type: ignore

logger = logging.getLogger(__name__)

_DATA_DIR = Path(os.getenv("POREIAGO_DATA_DIR") or Path(__file__).resolve().parents[2] / "data")
STORE_PATH = Path(os.getenv("INTEGRATIONS_SECRETS_STORE") or (_DATA_DIR / "integrations_secrets.json"))

SECRET_FIELDS = (
    "aviationstack_api_key",
    "twilio_account_sid",
    "twilio_auth_token",
    "twilio_from_number",
    "twilio_whatsapp_from",
)

_lock = threading.Lock()
_cache: dict[str, str] | None = None


def _fernet() -> "Fernet":
    if Fernet is None:
        raise RuntimeError("cryptography package required for integrations secrets")
    secret = (
        os.getenv("INTEGRATIONS_ENCRYPTION_KEY", "").strip()
        or os.getenv("FISCAL_ENCRYPTION_KEY", "").strip()
        or os.getenv("AUTH_JWT_SECRET", "").strip()
        or "poreiago-dev-integrations-key-change-in-production"
    )
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def _encrypt(plain: str) -> str:
    if not plain:
        return ""
    return f"enc:{_fernet().encrypt(plain.encode('utf-8')).decode('ascii')}"


def _decrypt(token: str) -> str:
    if not token:
        return ""
    raw = token[4:] if token.startswith("enc:") else token
    try:
        return _fernet().decrypt(raw.encode("ascii")).decode("utf-8")
    except InvalidToken:
        logger.warning("Unable to decrypt integrations secret — treating as empty")
        return ""


def _read_raw() -> dict[str, Any]:
    if not STORE_PATH.exists():
        return {}
    try:
        data = json.loads(STORE_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _write_raw(payload: dict[str, Any]) -> None:
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = STORE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(STORE_PATH)


def clear_cache() -> None:
    global _cache
    with _lock:
        _cache = None


def load_secrets() -> dict[str, str]:
    """Decrypted store values (may be empty strings)."""
    global _cache
    with _lock:
        if _cache is not None:
            return dict(_cache)
        raw = _read_raw()
        enc = raw.get("encrypted") if isinstance(raw.get("encrypted"), dict) else {}
        out = {field: _decrypt(str(enc.get(field) or "")) for field in SECRET_FIELDS}
        _cache = out
        return dict(out)


def save_secrets(updates: dict[str, Any], *, clear_fields: list[str] | None = None) -> dict[str, str]:
    """
    Merge updates into encrypted store.
    - Empty / whitespace values are ignored (keep existing), unless listed in clear_fields.
    - clear_fields explicitly wipe a secret.
    """
    clear = {str(f) for f in (clear_fields or []) if f in SECRET_FIELDS}
    current = load_secrets()
    next_vals = dict(current)
    for field in SECRET_FIELDS:
        if field in clear:
            next_vals[field] = ""
            continue
        if field not in updates:
            continue
        val = updates.get(field)
        if val is None:
            continue
        text = str(val).strip()
        if not text:
            continue
        next_vals[field] = text

    encrypted = {field: _encrypt(next_vals.get(field) or "") for field in SECRET_FIELDS}
    with _lock:
        _write_raw({"version": 1, "encrypted": encrypted})
        global _cache
        _cache = dict(next_vals)
    return dict(next_vals)


def _env_fallback(field: str) -> str:
    env_map = {
        "aviationstack_api_key": "AVIATIONSTACK_API_KEY",
        "twilio_account_sid": "TWILIO_ACCOUNT_SID",
        "twilio_auth_token": "TWILIO_AUTH_TOKEN",
        "twilio_from_number": "TWILIO_FROM_NUMBER",
        "twilio_whatsapp_from": "TWILIO_WHATSAPP_FROM",
    }
    return os.getenv(env_map.get(field, ""), "").strip()


def effective_secrets() -> dict[str, str]:
    """Store value if set, else env. Used by hybrid providers at runtime."""
    stored = load_secrets()
    out: dict[str, str] = {}
    for field in SECRET_FIELDS:
        out[field] = (stored.get(field) or "").strip() or _env_fallback(field)
    return out


def public_status() -> dict[str, Any]:
    """Readiness flags + sources (never plaintext secrets)."""
    stored = load_secrets()
    effective = effective_secrets()

    def source_for(field: str) -> str:
        if (stored.get(field) or "").strip():
            return "ui"
        if _env_fallback(field):
            return "env"
        return "none"

    aviation = bool(effective.get("aviationstack_api_key"))
    twilio_sms = bool(
        effective.get("twilio_account_sid")
        and effective.get("twilio_auth_token")
        and effective.get("twilio_from_number")
    )
    wa_from = effective.get("twilio_whatsapp_from") or ""
    if not wa_from and twilio_sms:
        wa_from = f"whatsapp:{effective['twilio_from_number']}"
    twilio_whatsapp = twilio_sms and bool(wa_from)

    return {
        "aviationstack": {
            "configured": aviation,
            "mode": "live" if aviation else "stub",
            "source": source_for("aviationstack_api_key"),
        },
        "twilio_sms": {
            "configured": twilio_sms,
            "mode": "live" if twilio_sms else "stub",
            "source": (
                "ui"
                if all((stored.get(f) or "").strip() for f in ("twilio_account_sid", "twilio_auth_token", "twilio_from_number"))
                else "env"
                if twilio_sms
                else "none"
            ),
        },
        "twilio_whatsapp": {
            "configured": twilio_whatsapp,
            "mode": "live" if twilio_whatsapp else "stub",
            "source": source_for("twilio_whatsapp_from") if twilio_whatsapp else ("none" if not twilio_sms else source_for("twilio_from_number")),
        },
        "fields": {
            field: {
                "configured": bool((effective.get(field) or "").strip()),
                "source": source_for(field),
            }
            for field in SECRET_FIELDS
        },
    }
