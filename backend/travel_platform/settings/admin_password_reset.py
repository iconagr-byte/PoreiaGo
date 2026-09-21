"""Signed password-reset tokens for backoffice / SaaS users (not wallet customers).

Security properties:
- HMAC-SHA256 over version|user|tenant|exp|pwd_fingerprint (AUTH_JWT_SECRET)
- Short TTL (1h); fingerprint invalidates token after password change (one-shot)
- Constant-time signature compare; production refuses weak/missing secrets
- Confirm endpoint is rate-limited per client IP
"""

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
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services.auth_service import hash_password

logger = logging.getLogger(__name__)

TOKEN_TTL_SECONDS = 60 * 60  # 1 hour
MIN_ADMIN_PASSWORD_LEN = 8
_TOKEN_VERSION = "v1"
_WEAK_SECRETS = frozenset(
    {
        "",
        "dev-admin-password-reset-secret",
        "change-me",
        "change-me-in-production",
        "dev-jwt",
        "dev-jwt-secret-change-in-prod",
    }
)

# confirm rate limit: sliding window per IP
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
        raise RuntimeError("AUTH_JWT_SECRET required for admin password-reset tokens")
    if len(raw) >= 16 and raw.lower() not in _WEAK_SECRETS:
        return raw
    # Dev-only fallback — never used when ENVIRONMENT=production.
    return "dev-admin-password-reset-secret"


def _public_base_url() -> str:
    return (
        os.getenv("PUBLIC_APP_URL")
        or os.getenv("VITE_APP_URL")
        or "http://localhost:5173"
    ).rstrip("/")


def password_fingerprint(password_hash: str | None) -> str:
    raw = str(password_hash or "")
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def fingerprints_match(a: str | None, b: str | None) -> bool:
    return hmac.compare_digest(str(a or ""), str(b or ""))


def validate_new_admin_password(password: str | None) -> str:
    pwd = (password or "").strip()
    if len(pwd) < MIN_ADMIN_PASSWORD_LEN:
        raise ValueError(
            f"Ο κωδικός πρέπει να έχει τουλάχιστον {MIN_ADMIN_PASSWORD_LEN} χαρακτήρες"
        )
    if pwd.isdigit() or pwd.isalpha():
        raise ValueError("Ο κωδικός πρέπει να συνδυάζει γράμματα και αριθμούς")
    return pwd


def create_reset_token(
    *,
    user_id: str,
    tenant_id: str,
    password_hash: str | None,
    ttl_seconds: int = TOKEN_TTL_SECONDS,
) -> str:
    expires = int(time.time()) + max(60, int(ttl_seconds))
    payload = "|".join(
        [
            _TOKEN_VERSION,
            str(user_id).strip(),
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
    version, user_id, tenant_id, expires_s, fp, sig = parts
    if not user_id or len(user_id) > 64 or len(fp) > 32:
        raise ValueError("Μη έγκυρος σύνδεσμος επαναφοράς")
    payload = "|".join([version, user_id, tenant_id, expires_s, fp])
    expected = hmac.new(_secret().encode(), payload.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise ValueError("Μη έγκυρος σύνδεσμος επαναφοράς")
    try:
        expires = int(expires_s)
    except ValueError as exc:
        raise ValueError("Μη έγκυρος σύνδεσμος επαναφοράς") from exc
    if expires < int(time.time()):
        raise ValueError("Ο σύνδεσμος έχει λήξει — ζητήστε νέο από τον διαχειριστή")
    return {
        "user_id": user_id,
        "tenant_id": tenant_id,
        "fingerprint": fp,
        "expires": expires,
    }


def build_reset_url(token: str) -> str:
    return f"{_public_base_url()}/admin/reset-password?token={token}"


def allow_confirm_attempt(client_key: str) -> bool:
    """Sliding-window rate limit for public confirm (anti-bruteforce)."""
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


def memory_fallback_allowed() -> bool:
    """In-memory demo users only outside production."""
    return not _is_production()


async def _disable_rls(session: AsyncSession) -> None:
    try:
        await session.execute(text("SET LOCAL row_security = off"))
    except Exception:
        pass


async def get_user_any_tenant(session: AsyncSession, user_id: UUID) -> User | None:
    await _disable_rls(session)
    result = await session.execute(select(User).where(User.id == user_id).limit(1))
    return result.scalar_one_or_none()


async def find_users_by_email(session: AsyncSession, email: str) -> list[User]:
    await _disable_rls(session)
    email_l = email.strip().lower()
    result = await session.execute(
        select(User)
        .where(func.lower(User.email) == email_l)
        .order_by(User.created_at.desc())
    )
    return list(result.scalars().all())


async def apply_password_reset(
    session: AsyncSession,
    *,
    token: str,
    new_password: str,
) -> User:
    pwd = validate_new_admin_password(new_password)
    parsed = parse_reset_token(token)
    try:
        uid = UUID(parsed["user_id"])
    except ValueError as exc:
        raise ValueError("Μη έγκυρος σύνδεσμος επαναφοράς") from exc
    user = await get_user_any_tenant(session, uid)
    if not user or not user.is_active:
        raise ValueError("Ο λογαριασμός δεν βρέθηκε ή είναι ανενεργός")
    if parsed["tenant_id"] and str(user.tenant_id) != parsed["tenant_id"]:
        raise ValueError("Μη έγκυρος σύνδεσμος επαναφοράς")
    if not fingerprints_match(password_fingerprint(user.password_hash), parsed["fingerprint"]):
        raise ValueError("Ο σύνδεσμος έχει ήδη χρησιμοποιηθεί ή ο κωδικός άλλαξε")
    user.password_hash = hash_password(pwd)
    await session.flush()
    return user


async def send_admin_reset_email(*, to_email: str, full_name: str, reset_url: str) -> str:
    from ticketing.email_dispatch import send_email

    safe_name = html.escape((full_name or to_email or "").strip() or to_email, quote=True)
    safe_url = html.escape(reset_url, quote=True)
    subject = "PoreiaGo — Επαναφορά κωδικού γραφείου"
    html_body = f"""<!DOCTYPE html><html lang="el"><body style="font-family:Arial,sans-serif;padding:24px;color:#0f172a;">
      <h2 style="margin:0 0 12px;">Επαναφορά κωδικού</h2>
      <p>Γεια σας {safe_name},</p>
      <p>Ο διαχειριστής πλατφόρμας ζήτησε νέο σύνδεσμο για να ορίσετε κωδικό εισόδου στο backoffice.</p>
      <p><a href="{safe_url}" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#fff;text-decoration:none;border-radius:999px;font-weight:bold;">Ορισμός νέου κωδικού</a></p>
      <p style="font-size:12px;color:#64748b;">Ο σύνδεσμος λήγει σε 1 ώρα. Αν δεν το ζητήσατε, αγνοήστε το email.</p>
      <p style="font-size:11px;color:#94a3b8;word-break:break-all;">{safe_url}</p>
    </body></html>"""
    return await send_email(to_email, subject, html_body)
