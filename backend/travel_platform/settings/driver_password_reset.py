"""Signed password-reset tokens for fleet driver PWA (/driver)."""

from __future__ import annotations

import hashlib
import hmac
import html
import logging
import os
import threading
import time
from base64 import urlsafe_b64decode, urlsafe_b64encode
from collections import defaultdict, deque
from typing import Any

from travel_platform.settings.drivers_store import (
    find_driver_by_username,
    get_driver,
    is_seed_driver,
    update_driver,
)

logger = logging.getLogger(__name__)

TOKEN_TTL_SECONDS = 60 * 60  # 1 hour
MIN_DRIVER_PASSWORD_LEN = 4
_TOKEN_VERSION = "drv1"
_WEAK_SECRETS = frozenset(
    {
        "",
        "dev-driver-password-reset-secret",
        "change-me",
        "change-me-in-production",
        "dev-jwt",
        "dev-jwt-secret-change-in-prod",
    }
)

_CONFIRM_WINDOW_SEC = 60
_CONFIRM_MAX_PER_WINDOW = 10
_confirm_hits: dict[str, deque[float]] = defaultdict(deque)
_confirm_lock = threading.Lock()


def _is_production() -> bool:
    return (os.getenv("ENVIRONMENT") or "").strip().lower() in ("production", "prod")


def _secret() -> str:
    raw = (
        (os.getenv("AUTH_JWT_SECRET") or "").strip()
        or (os.getenv("TICKET_JWT_SECRET") or "").strip()
        or (os.getenv("SECRET_KEY") or "").strip()
    )
    if len(raw) >= 32 and raw.lower() not in _WEAK_SECRETS and "change-me" not in raw.lower():
        return raw
    if _is_production():
        raise RuntimeError("AUTH_JWT_SECRET required for driver password-reset tokens")
    if len(raw) >= 16 and raw.lower() not in _WEAK_SECRETS:
        return raw
    return "dev-driver-password-reset-secret"


def password_fingerprint(password_hash: str | None) -> str:
    raw = str(password_hash or "")
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def fingerprints_match(a: str | None, b: str | None) -> bool:
    return hmac.compare_digest(str(a or ""), str(b or ""))


def validate_new_driver_password(password: str | None) -> str:
    pwd = (password or "").strip()
    if len(pwd) < MIN_DRIVER_PASSWORD_LEN:
        raise ValueError(
            f"Ο κωδικός πρέπει να έχει τουλάχιστον {MIN_DRIVER_PASSWORD_LEN} χαρακτήρες"
        )
    return pwd


def create_reset_token(
    *,
    driver_id: str,
    tenant_id: str,
    password_hash: str | None,
    ttl_seconds: int = TOKEN_TTL_SECONDS,
) -> str:
    expires = int(time.time()) + max(60, int(ttl_seconds))
    payload = "|".join(
        [
            _TOKEN_VERSION,
            str(driver_id).strip(),
            str(tenant_id or "").strip(),
            str(expires),
            password_fingerprint(password_hash),
        ]
    )
    sig = hmac.new(_secret().encode(), payload.encode(), hashlib.sha256).hexdigest()
    raw = f"{payload}|{sig}".encode()
    return urlsafe_b64encode(raw).decode().rstrip("=")


def parse_reset_token(token: str) -> dict[str, Any]:
    raw = (token or "").strip()
    if not raw or len(raw) > 2048:
        raise ValueError("Μη έγκυρος σύνδεσμος επαναφοράς")
    pad = "=" * (-len(raw) % 4)
    try:
        decoded = urlsafe_b64decode(raw + pad).decode()
    except Exception as exc:
        raise ValueError("Μη έγκυρος σύνδεσμος επαναφοράς") from exc
    parts = decoded.split("|")
    if len(parts) != 6 or parts[0] != _TOKEN_VERSION:
        raise ValueError("Μη έγκυρος σύνδεσμος επαναφοράς")
    version, driver_id, tenant_id, expires_s, fp, sig = parts
    if not driver_id or len(driver_id) > 64 or len(fp) > 32:
        raise ValueError("Μη έγκυρος σύνδεσμος επαναφοράς")
    payload = "|".join([version, driver_id, tenant_id, expires_s, fp])
    expected = hmac.new(_secret().encode(), payload.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise ValueError("Μη έγκυρος σύνδεσμος επαναφοράς")
    try:
        expires = int(expires_s)
    except ValueError as exc:
        raise ValueError("Μη έγκυρος σύνδεσμος επαναφοράς") from exc
    if expires < int(time.time()):
        raise ValueError("Ο σύνδεσμος έχει λήξει — ζητήστε νέο από την είσοδο οδηγού")
    return {
        "driver_id": driver_id,
        "tenant_id": tenant_id,
        "fingerprint": fp,
        "expires": expires,
    }


def build_reset_url(token: str, *, base_url: str | None = None) -> str:
    base = (
        (base_url or "").strip()
        or (os.getenv("PUBLIC_APP_URL") or "").strip()
        or (os.getenv("VITE_APP_URL") or "").strip()
        or "http://localhost:5173"
    ).rstrip("/")
    return f"{base}/driver/reset-password?token={token}"


def allow_confirm_attempt(client_key: str) -> bool:
    key = (client_key or "unknown").strip()[:128] or "unknown"
    now = time.time()
    with _confirm_lock:
        q = _confirm_hits[key]
        while q and now - q[0] > _CONFIRM_WINDOW_SEC:
            q.popleft()
        if len(q) >= _CONFIRM_MAX_PER_WINDOW:
            return False
        q.append(now)
        return True


def reset_confirm_rate_limits_for_tests() -> None:
    with _confirm_lock:
        _confirm_hits.clear()


def resolve_driver_for_reset(
    username: str,
    *,
    tenant_id: str | None = None,
    allow_demo_legacy: bool = False,
):
    driver = find_driver_by_username(
        username,
        tenant_id=tenant_id,
        allow_demo_legacy=allow_demo_legacy,
    )
    if not driver or is_seed_driver(driver):
        return None
    if driver.status not in ("active", "on_leave"):
        return None
    email = str(getattr(driver, "email", "") or "").strip().lower()
    if not email or "@" not in email:
        return None
    return driver


def apply_password_reset(*, token: str, new_password: str):
    pwd = validate_new_driver_password(new_password)
    parsed = parse_reset_token(token)
    driver = get_driver(parsed["driver_id"])
    if not driver or is_seed_driver(driver):
        raise ValueError("Μη έγκυρος σύνδεσμος επαναφοράς")
    if driver.status not in ("active", "on_leave"):
        raise ValueError("Ο λογαριασμός οδηγού δεν είναι ενεργός")
    if not fingerprints_match(parsed["fingerprint"], password_fingerprint(driver.password_hash)):
        raise ValueError("Ο σύνδεσμος δεν ισχύει πλέον — ζητήστε νέο")
    token_tid = str(parsed.get("tenant_id") or "").strip()
    driver_tid = str(getattr(driver, "tenant_id", "") or "").strip()
    if token_tid and driver_tid and token_tid != driver_tid:
        raise ValueError("Μη έγκυρος σύνδεσμος επαναφοράς")
    return update_driver(driver.id, {"password": pwd})


async def send_driver_reset_email(
    *,
    to_email: str,
    driver_name: str | None,
    reset_url: str,
) -> None:
    from ticketing.email_dispatch import send_email

    who = html.escape((driver_name or "Οδηγέ").strip() or "Οδηγέ")
    link = html.escape(reset_url)
    subject = "Επαναφορά κωδικού — εφαρμογή οδηγού PoreiaGo"
    body = f"""
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
      <h2 style="margin:0 0 12px">Επαναφορά κωδικού οδηγού</h2>
      <p>Γεια σου {who},</p>
      <p>Ζητήθηκε επαναφορά κωδικού για την εφαρμογή βάρδιας. Πατήστε τον σύνδεσμο:</p>
      <p style="margin:20px 0">
        <a href="{link}" style="display:inline-block;background:#1d4ed8;color:#fff;
          text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700">
          Ορισμός νέου κωδικού
        </a>
      </p>
      <p style="font-size:12px;color:#64748b">Ο σύνδεσμος λήγει σε 1 ώρα. Αν δεν το ζητήσατε εσείς, αγνοήστε το email.</p>
    </div>
    """
    await send_email(to_email, subject, body)
