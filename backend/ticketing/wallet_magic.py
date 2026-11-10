"""Short-lived My Wallet magic-link tokens (phase B)."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from .customer_accounts import get_account, _next_customer_id, _now_iso
from .db import get_db

MAGIC_TTL_MINUTES = 15


def _parse_expiry(raw: str | None) -> datetime | None:
    if not raw:
        return None
    expires = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    return expires


async def ensure_magic_account(
    email: str,
    *,
    name: str | None = None,
    phone: str | None = None,
) -> dict:
    """Create or reuse a customer account without requiring a password."""
    key = email.strip().lower()
    if not key or "@" not in key:
        raise ValueError("Μη έγκυρο email")

    existing = await get_account(key)
    now = _now_iso()
    db = get_db()
    if existing:
        await db.execute(
            """
            UPDATE customer_accounts
            SET name = COALESCE(NULLIF(?, ''), name),
                phone = COALESCE(NULLIF(?, ''), phone),
                updated_at = ?
            WHERE email = ?
            """,
            ((name or "").strip(), (phone or "").strip(), now, key),
        )
        await db.commit()
        return await get_account(key)  # type: ignore[return-value]

    customer_id = await _next_customer_id()
    display_name = (name or "").strip() or key.split("@")[0]
    await db.execute(
        """
        INSERT INTO customer_accounts
          (email, password_hash, name, phone, auth_provider, customer_id, created_at, updated_at)
        VALUES (?, NULL, ?, ?, 'magic', ?, ?, ?)
        """,
        (key, display_name, (phone or "").strip(), customer_id, now, now),
    )
    await db.commit()
    return await get_account(key)  # type: ignore[return-value]


async def create_wallet_magic_token(
    *,
    email: str,
    booking_id: str,
    name: str | None = None,
    phone: str | None = None,
) -> str:
    """Issue a single-use magic token bound to email + booking."""
    key = email.strip().lower()
    bid = str(booking_id or "").strip()
    if not key or not bid:
        raise ValueError("Απαιτείται email και κράτηση")

    await ensure_magic_account(key, name=name, phone=phone)
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc).replace(microsecond=0)
    expires = (now + timedelta(minutes=MAGIC_TTL_MINUTES)).isoformat()
    db = get_db()
    await db.execute(
        """
        INSERT INTO wallet_magic_tokens
          (token, email, booking_id, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (token, key, bid, expires, now.isoformat()),
    )
    await db.commit()
    return token


async def consume_wallet_magic_token(token: str) -> dict:
    """
    Validate + mark used. Returns {account, booking_id}.
    """
    raw = (token or "").strip()
    if len(raw) < 10:
        raise ValueError("Μη έγκυρος σύνδεσμος")

    db = get_db()
    cursor = await db.execute(
        "SELECT * FROM wallet_magic_tokens WHERE token = ?",
        (raw,),
    )
    row = await cursor.fetchone()
    if not row:
        raise ValueError("Μη έγκυρος ή ληγμένος σύνδεσμος")

    if row["used_at"]:
        raise ValueError("Ο σύνδεσμος έχει ήδη χρησιμοποιηθεί")

    expires = _parse_expiry(row["expires_at"])
    if not expires or datetime.now(timezone.utc) > expires:
        raise ValueError("Ο σύνδεσμος έχει λήξει — ζητήστε νέο από το email εισιτηρίου")

    now = _now_iso()
    await db.execute(
        "UPDATE wallet_magic_tokens SET used_at = ? WHERE token = ? AND used_at IS NULL",
        (now, raw),
    )
    await db.commit()

    account = await get_account(row["email"])
    if not account:
        # Should not happen — recreate soft account.
        account = await ensure_magic_account(row["email"])

    return {
        "account": account,
        "booking_id": row["booking_id"],
        "email": row["email"],
    }
