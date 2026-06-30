"""SQLite — EmailMessage cache, subscribers, campaign tracking."""

from __future__ import annotations

import json
import secrets
import uuid
from datetime import datetime, timezone

from ticketing.db import get_db

from .constants import FOLDER_INBOX, FOLDER_TRASH

EMAIL_CLIENT_SCHEMA = """
CREATE TABLE IF NOT EXISTS email_messages (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    sender TEXT NOT NULL DEFAULT '',
    recipient TEXT NOT NULL DEFAULT '',
    body_html TEXT NOT NULL DEFAULT '',
    body_text TEXT,
    folder TEXT NOT NULL DEFAULT 'Inbox',
    is_read INTEGER NOT NULL DEFAULT 0,
    message_date TEXT NOT NULL,
    imap_uid TEXT,
    in_reply_to TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_msg_id ON email_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_email_folder_date ON email_messages(folder, message_date DESC);
CREATE INDEX IF NOT EXISTS idx_email_sender ON email_messages(sender);

CREATE TABLE IF NOT EXISTS email_subscribers (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    customer_id TEXT,
    name TEXT,
    is_subscribed INTEGER NOT NULL DEFAULT 1,
    unsubscribed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subscribers_subscribed ON email_subscribers(is_subscribed);

CREATE TABLE IF NOT EXISTS campaign_send_log (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    tracking_token TEXT NOT NULL UNIQUE,
    opened INTEGER NOT NULL DEFAULT 0,
    opened_at TEXT,
    clicked INTEGER NOT NULL DEFAULT 0,
    clicked_at TEXT,
    sent_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id)
);
CREATE INDEX IF NOT EXISTS idx_campaign_send_campaign ON campaign_send_log(campaign_id);
"""


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def _row_message(row) -> dict:
    keys = row.keys()
    return {
        "id": row["id"],
        "email_settings_id": row["email_settings_id"] if "email_settings_id" in keys else None,
        "message_id": row["message_id"],
        "subject": row["subject"],
        "sender": row["sender"],
        "recipient": row["recipient"],
        "body_html": row["body_html"],
        "body_text": row["body_text"],
        "folder": row["folder"],
        "is_read": bool(row["is_read"]),
        "date": row["message_date"],
        "imap_uid": row["imap_uid"],
        "in_reply_to": row["in_reply_to"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _row_subscriber(row) -> dict:
    return {
        "id": row["id"],
        "email": row["email"],
        "customer_id": row["customer_id"],
        "name": row["name"],
        "is_subscribed": bool(row["is_subscribed"]),
        "unsubscribed_at": row["unsubscribed_at"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


async def init_email_client_tables() -> None:
    from .settings_store import init_email_settings_tables

    db = get_db()
    await db.executescript(EMAIL_CLIENT_SCHEMA)
    await _migrate_campaign_metrics(db)
    await db.commit()
    await init_email_settings_tables()
    await sync_subscribers_from_accounts()


async def _migrate_campaign_metrics(db) -> None:
    cur = await db.execute("PRAGMA table_info(email_campaigns)")
    cols = {r[1] for r in await cur.fetchall()}
    if "open_count" not in cols:
        await db.execute("ALTER TABLE email_campaigns ADD COLUMN open_count INTEGER NOT NULL DEFAULT 0")
    if "click_count" not in cols:
        await db.execute("ALTER TABLE email_campaigns ADD COLUMN click_count INTEGER NOT NULL DEFAULT 0")


async def sync_subscribers_from_accounts() -> None:
    """Συγχρονισμός πελατών από customer_accounts → email_subscribers."""
    from ticketing.customer_accounts import list_all_accounts

    accounts = await list_all_accounts()
    if not accounts:
        return
    db = get_db()
    for acc in accounts:
        email = (acc.get("email") or "").strip().lower()
        if not email:
            continue
        cur = await db.execute("SELECT id FROM email_subscribers WHERE email = ?", (email,))
        if await cur.fetchone():
            continue
        await db.execute(
            """
            INSERT INTO email_subscribers (id, email, customer_id, name, is_subscribed, created_at, updated_at)
            VALUES (?, ?, ?, ?, 1, ?, ?)
            """,
            (
                _new_id("SUB"),
                email,
                acc.get("customer_id"),
                acc.get("name") or "",
                _now(),
                _now(),
            ),
        )
    await db.commit()


async def upsert_message(data: dict) -> dict | None:
    """Εισαγωγή ή ενημέρωση αν υπάρχει το ίδιο message_id (+ λογαριασμός)."""
    mid = (data.get("message_id") or "").strip()
    if not mid:
        return None
    sid = data.get("email_settings_id")
    db = get_db()
    if sid:
        cur = await db.execute(
            "SELECT id FROM email_messages WHERE message_id = ? AND email_settings_id = ?",
            (mid, sid),
        )
    else:
        cur = await db.execute(
            """
            SELECT id FROM email_messages
            WHERE message_id = ? AND (email_settings_id IS NULL OR email_settings_id = '')
            """,
            (mid,),
        )
    existing = await cur.fetchone()
    now = _now()
    if existing:
        eid = existing["id"]
        await db.execute(
            """
            UPDATE email_messages
            SET subject=?, sender=?, recipient=?, body_html=?, body_text=?,
                folder=?, is_read=?, message_date=?, imap_uid=?,
                email_settings_id=COALESCE(?, email_settings_id), updated_at=?
            WHERE id=?
            """,
            (
                data.get("subject", ""),
                data.get("sender", ""),
                data.get("recipient", ""),
                data.get("body_html", ""),
                data.get("body_text"),
                data.get("folder", FOLDER_INBOX),
                1 if data.get("is_read") else 0,
                data.get("date") or now,
                data.get("imap_uid"),
                sid,
                now,
                eid,
            ),
        )
        await db.commit()
        return await get_message(eid)

    eid = _new_id("EM")
    await db.execute(
        """
        INSERT INTO email_messages
          (id, email_settings_id, message_id, subject, sender, recipient, body_html, body_text,
           folder, is_read, message_date, imap_uid, in_reply_to, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            eid,
            sid,
            mid,
            data.get("subject", ""),
            data.get("sender", ""),
            data.get("recipient", ""),
            data.get("body_html", ""),
            data.get("body_text"),
            data.get("folder", FOLDER_INBOX),
            1 if data.get("is_read") else 0,
            data.get("date") or now,
            data.get("imap_uid"),
            data.get("in_reply_to"),
            now,
            now,
        ),
    )
    await db.commit()
    return await get_message(eid)


async def get_message(message_pk: str) -> dict | None:
    db = get_db()
    cur = await db.execute("SELECT * FROM email_messages WHERE id = ?", (message_pk,))
    row = await cur.fetchone()
    return _row_message(row) if row else None


async def list_messages(
    *,
    folder: str,
    email_settings_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
    search: str | None = None,
) -> list[dict]:
    db = get_db()
    q = "SELECT * FROM email_messages WHERE folder = ?"
    params: list = [folder]
    if email_settings_id:
        q += " AND email_settings_id = ?"
        params.append(email_settings_id)
    if search:
        q += " AND (subject LIKE ? OR sender LIKE ? OR recipient LIKE ?)"
        like = f"%{search}%"
        params.extend([like, like, like])
    q += " ORDER BY message_date DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    cur = await db.execute(q, params)
    return [_row_message(r) for r in await cur.fetchall()]


async def folder_unread_counts(*, email_settings_id: str | None = None) -> dict[str, int]:
    db = get_db()
    q = """
        SELECT folder, COUNT(*) AS cnt
        FROM email_messages
        WHERE is_read = 0 AND folder != ?
    """
    params: list = [FOLDER_TRASH]
    if email_settings_id:
        q += " AND email_settings_id = ?"
        params.append(email_settings_id)
    q += " GROUP BY folder"
    cur = await db.execute(q, params)
    rows = await cur.fetchall()
    return {r["folder"]: int(r["cnt"]) for r in rows}


async def update_message(message_pk: str, patch: dict) -> dict | None:
    msg = await get_message(message_pk)
    if not msg:
        return None
    folder = patch.get("folder", msg["folder"])
    is_read = patch.get("is_read", msg["is_read"])
    db = get_db()
    await db.execute(
        """
        UPDATE email_messages SET folder=?, is_read=?, updated_at=? WHERE id=?
        """,
        (folder, 1 if is_read else 0, _now(), message_pk),
    )
    await db.commit()
    return await get_message(message_pk)


async def save_draft(data: dict) -> dict:
    eid = data.get("id") or _new_id("EM")
    now = _now()
    mid = data.get("message_id") or f"draft-{eid}@local"
    db = get_db()
    cur = await db.execute("SELECT id FROM email_messages WHERE id = ?", (eid,))
    if await cur.fetchone():
        await db.execute(
            """
            UPDATE email_messages
            SET subject=?, sender=?, recipient=?, body_html=?, folder='Drafts', updated_at=?
            WHERE id=?
            """,
            (
                data.get("subject", ""),
                data.get("sender", ""),
                data.get("recipient", ""),
                data.get("body_html", ""),
                now,
                eid,
            ),
        )
    else:
        await db.execute(
            """
            INSERT INTO email_messages
              (id, message_id, subject, sender, recipient, body_html, folder, is_read, message_date, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'Drafts', 1, ?, ?, ?)
            """,
            (
                eid,
                mid,
                data.get("subject", ""),
                data.get("sender", ""),
                data.get("recipient", ""),
                data.get("body_html", ""),
                now,
                now,
                now,
            ),
        )
    await db.commit()
    return await get_message(eid)  # type: ignore[return-value]


async def record_sent_local(
    *,
    subject: str,
    sender: str,
    recipient: str,
    body_html: str,
    message_id: str | None = None,
    email_settings_id: str | None = None,
) -> dict:
    return await upsert_message(
        {
            "message_id": message_id or f"sent-{_new_id('m')}@local",
            "email_settings_id": email_settings_id,
            "subject": subject,
            "sender": sender,
            "recipient": recipient,
            "body_html": body_html,
            "folder": "Sent",
            "is_read": True,
            "date": _now(),
        }
    )  # type: ignore[return-value]


# --- Subscribers ---

async def list_subscribers(*, subscribed_only: bool = False) -> list[dict]:
    db = get_db()
    q = "SELECT * FROM email_subscribers"
    if subscribed_only:
        q += " WHERE is_subscribed = 1"
    q += " ORDER BY email ASC"
    cur = await db.execute(q)
    return [_row_subscriber(r) for r in await cur.fetchall()]


async def get_subscriber_by_email(email: str) -> dict | None:
    key = email.strip().lower()
    db = get_db()
    cur = await db.execute("SELECT * FROM email_subscribers WHERE email = ?", (key,))
    row = await cur.fetchone()
    return _row_subscriber(row) if row else None


async def set_subscription(email: str, is_subscribed: bool) -> dict | None:
    sub = await get_subscriber_by_email(email)
    if not sub:
        return None
    db = get_db()
    now = _now()
    await db.execute(
        """
        UPDATE email_subscribers
        SET is_subscribed=?, unsubscribed_at=?, updated_at=?
        WHERE email=?
        """,
        (1 if is_subscribed else 0, None if is_subscribed else now, now, email.strip().lower()),
    )
    await db.commit()
    return await get_subscriber_by_email(email)


async def unsubscribe_by_token(token: str) -> bool:
    db = get_db()
    cur = await db.execute(
        "SELECT recipient_email FROM campaign_send_log WHERE tracking_token = ?",
        (token,),
    )
    row = await cur.fetchone()
    if not row:
        return False
    email = row["recipient_email"]
    await set_subscription(email, False)
    return True


# --- Campaign tracking ---

async def create_send_log(campaign_id: str, recipient_email: str) -> dict:
    token = secrets.token_urlsafe(24)
    sid = _new_id("CSL")
    db = get_db()
    await db.execute(
        """
        INSERT INTO campaign_send_log (id, campaign_id, recipient_email, tracking_token, sent_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (sid, campaign_id, recipient_email.strip().lower(), token, _now()),
    )
    await db.commit()
    return {"id": sid, "campaign_id": campaign_id, "recipient_email": recipient_email, "tracking_token": token}


async def record_open(token: str) -> bool:
    db = get_db()
    cur = await db.execute(
        "SELECT id, campaign_id, opened FROM campaign_send_log WHERE tracking_token = ?",
        (token,),
    )
    row = await cur.fetchone()
    if not row:
        return False
    if not row["opened"]:
        await db.execute(
            "UPDATE campaign_send_log SET opened=1, opened_at=? WHERE tracking_token=?",
            (_now(), token),
        )
        await db.execute(
            "UPDATE email_campaigns SET open_count = open_count + 1 WHERE id = ?",
            (row["campaign_id"],),
        )
        await db.commit()
    return True


async def record_click(token: str) -> bool:
    db = get_db()
    cur = await db.execute(
        "SELECT id, campaign_id, clicked FROM campaign_send_log WHERE tracking_token = ?",
        (token,),
    )
    row = await cur.fetchone()
    if not row:
        return False
    if not row["clicked"]:
        await db.execute(
            "UPDATE campaign_send_log SET clicked=1, clicked_at=? WHERE tracking_token=?",
            (_now(), token),
        )
        await db.execute(
            "UPDATE email_campaigns SET click_count = click_count + 1 WHERE id = ?",
            (row["campaign_id"],),
        )
        await db.commit()
    return True


async def get_campaign_metrics(campaign_id: str) -> dict:
    db = get_db()
    cur = await db.execute(
        "SELECT open_count, click_count FROM email_campaigns WHERE id = ?",
        (campaign_id,),
    )
    row = await cur.fetchone()
    if not row:
        return {"open_count": 0, "click_count": 0, "sent_count": 0}
    cur2 = await db.execute(
        "SELECT COUNT(*) AS c FROM campaign_send_log WHERE campaign_id = ?",
        (campaign_id,),
    )
    sent = (await cur2.fetchone())["c"]
    return {
        "open_count": int(row["open_count"] or 0),
        "click_count": int(row["click_count"] or 0),
        "sent_count": int(sent),
    }
