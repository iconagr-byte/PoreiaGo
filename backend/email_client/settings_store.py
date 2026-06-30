"""EmailSettings — δυναμικοί λογαριασμοί IMAP/SMTP στη SQLite."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from ticketing.db import get_db

from .secrets_vault import decrypt_password, encrypt_password

EMAIL_SETTINGS_SCHEMA = """
CREATE TABLE IF NOT EXISTS email_settings (
    id TEXT PRIMARY KEY,
    owner_key TEXT NOT NULL DEFAULT 'default',
    user_id TEXT,
    label TEXT NOT NULL DEFAULT '',
    email_address TEXT NOT NULL,
    imap_host TEXT NOT NULL DEFAULT '',
    imap_port INTEGER NOT NULL DEFAULT 993,
    imap_secure INTEGER NOT NULL DEFAULT 1,
    imap_mailbox TEXT NOT NULL DEFAULT 'INBOX',
    imap_folder_sent TEXT NOT NULL DEFAULT 'Sent',
    imap_folder_spam TEXT NOT NULL DEFAULT 'Spam',
    smtp_host TEXT NOT NULL DEFAULT '',
    smtp_port INTEGER NOT NULL DEFAULT 587,
    smtp_secure INTEGER NOT NULL DEFAULT 1,
    mail_username TEXT NOT NULL DEFAULT '',
    mail_password_enc TEXT NOT NULL DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1,
    last_sync_at TEXT,
    last_sync_error TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_email_settings_owner ON email_settings(owner_key, is_active);
"""


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _new_id() -> str:
    return f"EMS-{uuid.uuid4().hex[:12]}"


def _row_settings(row, *, include_password: bool = False) -> dict:
    out: dict[str, Any] = {
        "id": row["id"],
        "owner_key": row["owner_key"],
        "user_id": row["user_id"],
        "label": row["label"] or row["email_address"],
        "email_address": row["email_address"],
        "imap_host": row["imap_host"],
        "imap_port": int(row["imap_port"]),
        "imap_secure": bool(row["imap_secure"]),
        "imap_mailbox": row["imap_mailbox"],
        "imap_folder_sent": row["imap_folder_sent"],
        "imap_folder_spam": row["imap_folder_spam"],
        "smtp_host": row["smtp_host"],
        "smtp_port": int(row["smtp_port"]),
        "smtp_secure": bool(row["smtp_secure"]),
        "mail_username": row["mail_username"],
        "is_active": bool(row["is_active"]),
        "last_sync_at": row["last_sync_at"],
        "last_sync_error": row["last_sync_error"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "has_password": bool(row["mail_password_enc"]),
    }
    if include_password:
        out["mail_password"] = decrypt_password(row["mail_password_enc"])
    return out


async def init_email_settings_tables() -> None:
    db = get_db()
    await db.executescript(EMAIL_SETTINGS_SCHEMA)
    await _migrate_messages_account_fk(db)
    await _migrate_auto_responder_fk(db)
    await _migrate_campaigns_account_fk(db)
    await db.commit()


async def _migrate_messages_account_fk(db) -> None:
    cur = await db.execute("PRAGMA table_info(email_messages)")
    cols = {r[1] for r in await cur.fetchall()}
    if "email_settings_id" not in cols:
        await db.execute(
            "ALTER TABLE email_messages ADD COLUMN email_settings_id TEXT"
        )
    await db.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_email_msg_account
        ON email_messages(email_settings_id, message_id)
        """
    )


async def _migrate_auto_responder_fk(db) -> None:
    cur = await db.execute("PRAGMA table_info(auto_responder_rules)")
    cols = {r[1] for r in await cur.fetchall()}
    if cols and "email_settings_id" not in cols:
        await db.execute(
            "ALTER TABLE auto_responder_rules ADD COLUMN email_settings_id TEXT"
        )


async def _migrate_campaigns_account_fk(db) -> None:
    cur = await db.execute("PRAGMA table_info(email_campaigns)")
    cols = {r[1] for r in await cur.fetchall()}
    if cols and "email_settings_id" not in cols:
        await db.execute(
            "ALTER TABLE email_campaigns ADD COLUMN email_settings_id TEXT"
        )


async def list_settings(
    *,
    owner_key: str = "default",
    active_only: bool = False,
) -> list[dict]:
    db = get_db()
    q = "SELECT * FROM email_settings WHERE owner_key = ?"
    params: list = [owner_key]
    if active_only:
        q += " AND is_active = 1"
    q += " ORDER BY created_at ASC"
    cur = await db.execute(q, params)
    return [_row_settings(r) for r in await cur.fetchall()]


async def get_settings(settings_id: str, *, with_password: bool = False) -> dict | None:
    db = get_db()
    cur = await db.execute("SELECT * FROM email_settings WHERE id = ?", (settings_id,))
    row = await cur.fetchone()
    if not row:
        return None
    return _row_settings(row, include_password=with_password)


async def get_settings_for_send(settings_id: str | None) -> dict:
    """Επιστρέφει ρυθμίσεις με κωδικό — default πρώτο ενεργό account."""
    if settings_id:
        row = await get_settings(settings_id, with_password=True)
        if not row:
            raise ValueError("Ο λογαριασμός email δεν βρέθηκε")
        if not row["is_active"]:
            raise ValueError("Ο λογαριασμός email είναι ανενεργός")
        return row
    accounts = await list_settings(active_only=True)
    if not accounts:
        raise ValueError(
            "Δεν υπάρχει ρυθμισμένος λογαριασμός email. Προσθέστε έναν από Ρυθμίσεις Email."
        )
    return await get_settings(accounts[0]["id"], with_password=True)  # type: ignore[return-value]


async def create_settings(data: dict) -> dict:
    sid = _new_id()
    now = _now()
    password = data.get("mail_password") or ""
    enc = encrypt_password(password) if password else ""
    db = get_db()
    await db.execute(
        """
        INSERT INTO email_settings (
          id, owner_key, user_id, label, email_address,
          imap_host, imap_port, imap_secure, imap_mailbox, imap_folder_sent, imap_folder_spam,
          smtp_host, smtp_port, smtp_secure, mail_username, mail_password_enc,
          is_active, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            sid,
            data.get("owner_key", "default"),
            data.get("user_id"),
            data.get("label") or data["email_address"],
            data["email_address"].strip().lower(),
            data.get("imap_host", ""),
            int(data.get("imap_port", 993)),
            1 if data.get("imap_secure", True) else 0,
            data.get("imap_mailbox", "INBOX"),
            data.get("imap_folder_sent", "Sent"),
            data.get("imap_folder_spam", "Spam"),
            data.get("smtp_host", ""),
            int(data.get("smtp_port", 587)),
            1 if data.get("smtp_secure", True) else 0,
            data.get("mail_username", data["email_address"]),
            enc,
            1 if data.get("is_active", True) else 0,
            now,
            now,
        ),
    )
    await db.commit()
    return await get_settings(sid)  # type: ignore[return-value]


async def update_settings(settings_id: str, patch: dict) -> dict | None:
    existing = await get_settings(settings_id)
    if not existing:
        return None
    password = patch.get("mail_password")
    enc = None
    if password is not None:
        enc = encrypt_password(password) if password else existing.get("mail_password_enc", "")

    db = get_db()
    fields = {
        "label": patch.get("label", existing["label"]),
        "email_address": patch.get("email_address", existing["email_address"]),
        "imap_host": patch.get("imap_host", existing["imap_host"]),
        "imap_port": int(patch.get("imap_port", existing["imap_port"])),
        "imap_secure": 1 if patch.get("imap_secure", existing["imap_secure"]) else 0,
        "imap_mailbox": patch.get("imap_mailbox", existing["imap_mailbox"]),
        "imap_folder_sent": patch.get("imap_folder_sent", existing["imap_folder_sent"]),
        "imap_folder_spam": patch.get("imap_folder_spam", existing["imap_folder_spam"]),
        "smtp_host": patch.get("smtp_host", existing["smtp_host"]),
        "smtp_port": int(patch.get("smtp_port", existing["smtp_port"])),
        "smtp_secure": 1 if patch.get("smtp_secure", existing["smtp_secure"]) else 0,
        "mail_username": patch.get("mail_username", existing["mail_username"]),
        "is_active": 1 if patch.get("is_active", existing["is_active"]) else 0,
        "user_id": patch.get("user_id", existing["user_id"]),
    }
    if enc is not None:
        await db.execute(
            """
            UPDATE email_settings SET
              label=?, email_address=?, imap_host=?, imap_port=?, imap_secure=?,
              imap_mailbox=?, imap_folder_sent=?, imap_folder_spam=?,
              smtp_host=?, smtp_port=?, smtp_secure=?, mail_username=?,
              mail_password_enc=?, is_active=?, user_id=?, updated_at=?
            WHERE id=?
            """,
            (
                fields["label"],
                fields["email_address"].strip().lower(),
                fields["imap_host"],
                fields["imap_port"],
                fields["imap_secure"],
                fields["imap_mailbox"],
                fields["imap_folder_sent"],
                fields["imap_folder_spam"],
                fields["smtp_host"],
                fields["smtp_port"],
                fields["smtp_secure"],
                fields["mail_username"],
                enc,
                fields["is_active"],
                fields["user_id"],
                _now(),
                settings_id,
            ),
        )
    else:
        await db.execute(
            """
            UPDATE email_settings SET
              label=?, email_address=?, imap_host=?, imap_port=?, imap_secure=?,
              imap_mailbox=?, imap_folder_sent=?, imap_folder_spam=?,
              smtp_host=?, smtp_port=?, smtp_secure=?, mail_username=?,
              is_active=?, user_id=?, updated_at=?
            WHERE id=?
            """,
            (
                fields["label"],
                fields["email_address"].strip().lower(),
                fields["imap_host"],
                fields["imap_port"],
                fields["imap_secure"],
                fields["imap_mailbox"],
                fields["imap_folder_sent"],
                fields["imap_folder_spam"],
                fields["smtp_host"],
                fields["smtp_port"],
                fields["smtp_secure"],
                fields["mail_username"],
                fields["is_active"],
                fields["user_id"],
                _now(),
                settings_id,
            ),
        )
    await db.commit()
    return await get_settings(settings_id)


async def delete_settings(settings_id: str) -> bool:
    db = get_db()
    cur = await db.execute("DELETE FROM email_settings WHERE id = ?", (settings_id,))
    await db.commit()
    return cur.rowcount > 0


async def record_sync_result(
    settings_id: str,
    *,
    error: str | None = None,
) -> None:
    db = get_db()
    await db.execute(
        """
        UPDATE email_settings
        SET last_sync_at=?, last_sync_error=?, updated_at=?
        WHERE id=?
        """,
        (_now(), error, _now(), settings_id),
    )
    await db.commit()
