"""Customer accounts — SQLite persistence for My Wallet auth."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from .db import get_db
from .password_utils import hash_password, verify_password


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _row_to_account(row) -> dict:
    return {
        "email": row["email"],
        "name": row["name"] or "",
        "phone": row["phone"] or "",
        "picture": row["picture"] or "",
        "auth_provider": row["auth_provider"] or "email",
        "customer_id": row["customer_id"],
        "has_password": bool(row["password_hash"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


async def _next_customer_id() -> str:
    db = get_db()
    cursor = await db.execute(
        "SELECT customer_id FROM customer_accounts WHERE customer_id LIKE 'CUST-%'"
    )
    rows = await cursor.fetchall()
    nums = []
    for row in rows:
        cid = row["customer_id"] or ""
        if cid.startswith("CUST-"):
            try:
                nums.append(int(cid[5:]))
            except ValueError:
                pass
    n = max(nums, default=0) + 1
    return f"CUST-{n:03d}"


async def get_account(email: str) -> dict | None:
    key = email.strip().lower()
    if not key:
        return None
    db = get_db()
    cursor = await db.execute("SELECT * FROM customer_accounts WHERE email = ?", (key,))
    row = await cursor.fetchone()
    return _row_to_account(row) if row else None


async def list_all_accounts() -> list[dict]:
    db = get_db()
    cursor = await db.execute(
        "SELECT * FROM customer_accounts ORDER BY created_at DESC"
    )
    return [_row_to_account(r) for r in await cursor.fetchall()]


async def register_account(email: str, password: str, name: str | None = None) -> dict:
    key = email.strip().lower()
    if not key or "@" not in key:
        raise ValueError("Μη έγκυρο email")
    if len(password) < 6:
        raise ValueError("Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες")

    existing = await get_account(key)
    if existing:
        raise ValueError("Υπάρχει ήδη λογαριασμός με αυτό το email")

    customer_id = await _next_customer_id()
    display_name = (name or "").strip() or key.split("@")[0]
    now = _now_iso()
    db = get_db()
    await db.execute(
        """
        INSERT INTO customer_accounts
          (email, password_hash, name, auth_provider, customer_id, created_at, updated_at)
        VALUES (?, ?, ?, 'email', ?, ?, ?)
        """,
        (key, hash_password(password), display_name, customer_id, now, now),
    )
    await db.commit()
    return await get_account(key)  # type: ignore[return-value]


async def authenticate_account(email: str, password: str) -> dict | None:
    key = email.strip().lower()
    db = get_db()
    cursor = await db.execute("SELECT * FROM customer_accounts WHERE email = ?", (key,))
    row = await cursor.fetchone()
    if not row or not verify_password(password, row["password_hash"]):
        return None
    return _row_to_account(row)


async def upsert_google_account(email: str, name: str | None, picture: str | None) -> dict:
    key = email.strip().lower()
    existing = await get_account(key)
    now = _now_iso()
    db = get_db()

    if existing:
        await db.execute(
            """
            UPDATE customer_accounts
            SET name = COALESCE(?, name),
                picture = COALESCE(?, picture),
                auth_provider = 'google',
                updated_at = ?
            WHERE email = ?
            """,
            ((name or "").strip() or None, picture, now, key),
        )
        await db.commit()
        return await get_account(key)  # type: ignore[return-value]

    customer_id = await _next_customer_id()
    display_name = (name or "").strip() or key.split("@")[0]
    await db.execute(
        """
        INSERT INTO customer_accounts
          (email, password_hash, name, picture, auth_provider, customer_id, created_at, updated_at)
        VALUES (?, NULL, ?, ?, 'google', ?, ?, ?)
        """,
        (key, display_name, picture or "", customer_id, now, now),
    )
    await db.commit()
    return await get_account(key)  # type: ignore[return-value]


async def change_account_password(email: str, current_password: str, new_password: str) -> None:
    key = email.strip().lower()
    if len(new_password) < 6:
        raise ValueError("Ο νέος κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες")

    db = get_db()
    cursor = await db.execute("SELECT password_hash FROM customer_accounts WHERE email = ?", (key,))
    row = await cursor.fetchone()
    if not row:
        raise ValueError("Δεν βρέθηκε λογαριασμός")

    stored = row["password_hash"]
    if stored and not verify_password(current_password, stored):
        raise ValueError("Ο τρέχων κωδικός είναι λάθος")
    if not stored and current_password:
        # first password set for Google-only account — ignore wrong current if empty was sent
        pass

    await db.execute(
        "UPDATE customer_accounts SET password_hash = ?, auth_provider = 'email', updated_at = ? WHERE email = ?",
        (hash_password(new_password), _now_iso(), key),
    )
    await db.commit()


async def create_password_reset_token(email: str) -> str | None:
    """Returns reset token if account exists and can reset password."""
    key = email.strip().lower()
    db = get_db()
    cursor = await db.execute("SELECT email, password_hash FROM customer_accounts WHERE email = ?", (key,))
    row = await cursor.fetchone()
    if not row:
        return None

    token = secrets.token_urlsafe(32)
    expires = (datetime.now(timezone.utc) + timedelta(hours=1)).replace(microsecond=0).isoformat()
    await db.execute(
        "UPDATE customer_accounts SET reset_token = ?, reset_expires_at = ?, updated_at = ? WHERE email = ?",
        (token, expires, _now_iso(), key),
    )
    await db.commit()
    return token


async def reset_password_with_token(token: str, new_password: str) -> dict:
    if len(new_password) < 6:
        raise ValueError("Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες")

    db = get_db()
    cursor = await db.execute(
        "SELECT * FROM customer_accounts WHERE reset_token = ?",
        (token.strip(),),
    )
    row = await cursor.fetchone()
    if not row:
        raise ValueError("Μη έγκυρος ή ληγμένος σύνδεσμος επαναφοράς")

    expires_raw = row["reset_expires_at"]
    if not expires_raw:
        raise ValueError("Μη έγκυρος ή ληγμένος σύνδεσμος επαναφοράς")
    expires = datetime.fromisoformat(expires_raw.replace("Z", "+00:00"))
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires:
        raise ValueError("Ο σύνδεσμος επαναφοράς έχει λήξει")

    now = _now_iso()
    await db.execute(
        """
        UPDATE customer_accounts
        SET password_hash = ?, reset_token = NULL, reset_expires_at = NULL,
            auth_provider = 'email', updated_at = ?
        WHERE email = ?
        """,
        (hash_password(new_password), now, row["email"]),
    )
    await db.commit()
    return _row_to_account(row)
