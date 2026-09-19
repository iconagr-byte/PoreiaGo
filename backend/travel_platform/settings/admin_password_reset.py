"""Signed password-reset tokens for backoffice / SaaS users (not wallet customers)."""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import time
from base64 import urlsafe_b64decode, urlsafe_b64encode
from typing import Any
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services.auth_service import hash_password

logger = logging.getLogger(__name__)

TOKEN_TTL_SECONDS = 60 * 60  # 1 hour
_TOKEN_VERSION = "v1"


def _secret() -> str:
    raw = (
        (os.getenv("AUTH_JWT_SECRET") or "").strip()
        or (os.getenv("TICKET_JWT_SECRET") or "").strip()
        or (os.getenv("SECRET_KEY") or "").strip()
    )
    if len(raw) >= 16:
        return raw
    # Dev-only fallback — production_guard requires AUTH_JWT_SECRET.
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
    if not raw:
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
    pwd = (new_password or "").strip()
    if len(pwd) < 6:
        raise ValueError("Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες")
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
    if password_fingerprint(user.password_hash) != parsed["fingerprint"]:
        raise ValueError("Ο σύνδεσμος έχει ήδη χρησιμοποιηθεί ή ο κωδικός άλλαξε")
    user.password_hash = hash_password(pwd)
    await session.flush()
    return user


async def send_admin_reset_email(*, to_email: str, full_name: str, reset_url: str) -> str:
    from ticketing.email_dispatch import send_email

    name = (full_name or to_email or "").strip() or to_email
    subject = "PoreiaGo — Επαναφορά κωδικού γραφείου"
    html = f"""<!DOCTYPE html><html lang="el"><body style="font-family:Arial,sans-serif;padding:24px;color:#0f172a;">
      <h2 style="margin:0 0 12px;">Επαναφορά κωδικού</h2>
      <p>Γεια σας {name},</p>
      <p>Ο διαχειριστής πλατφόρμας ζήτησε νέο σύνδεσμο για να ορίσετε κωδικό εισόδου στο backoffice.</p>
      <p><a href="{reset_url}" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#fff;text-decoration:none;border-radius:999px;font-weight:bold;">Ορισμός νέου κωδικού</a></p>
      <p style="font-size:12px;color:#64748b;">Ο σύνδεσμος λήγει σε 1 ώρα. Αν δεν το ζητήσατε, αγνοήστε το email.</p>
      <p style="font-size:11px;color:#94a3b8;word-break:break-all;">{reset_url}</p>
    </body></html>"""
    return await send_email(to_email, subject, html)
