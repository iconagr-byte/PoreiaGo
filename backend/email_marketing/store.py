"""SQLite persistence — templates, campaigns, auto-responder rules."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from ticketing.db import get_db

from .constants import CAMPAIGN_STATUS_DRAFT, STANDARD_TEMPLATE_VARIABLES

EMAIL_SCHEMA = """
CREATE TABLE IF NOT EXISTS email_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    body_html TEXT NOT NULL DEFAULT '',
    variables_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Draft',
    sent_at TEXT,
    audience_filter TEXT NOT NULL DEFAULT 'all',
    stats_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON email_campaigns(status);

CREATE TABLE IF NOT EXISTS auto_responder_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    trigger_keywords TEXT NOT NULL,
    response_template TEXT NOT NULL,
    template_id TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    priority INTEGER NOT NULL DEFAULT 100,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (template_id) REFERENCES email_templates(id)
);
CREATE INDEX IF NOT EXISTS idx_ar_active ON auto_responder_rules(is_active, priority);

CREATE TABLE IF NOT EXISTS inbound_email_log (
    id TEXT PRIMARY KEY,
    message_id TEXT,
    from_addr TEXT NOT NULL,
    subject TEXT,
    body_preview TEXT,
    matched_rule_id TEXT,
    auto_replied INTEGER NOT NULL DEFAULT 0,
    processed_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inbound_msg ON inbound_email_log(message_id);

CREATE TABLE IF NOT EXISTS marketing_products (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    description TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
);
"""


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


async def init_email_marketing_tables() -> None:
    db = get_db()
    await db.executescript(EMAIL_SCHEMA)
    await _migrate_campaign_editor_fields(db)
    await db.commit()
    await _seed_defaults()


async def _migrate_campaign_editor_fields(db) -> None:
    cur = await db.execute("PRAGMA table_info(email_campaigns)")
    cols = {r[1] for r in await cur.fetchall()}
    if "preheader" not in cols:
        await db.execute("ALTER TABLE email_campaigns ADD COLUMN preheader TEXT DEFAULT ''")
    if "blocks_json" not in cols:
        await db.execute("ALTER TABLE email_campaigns ADD COLUMN blocks_json TEXT")
    cur = await db.execute("PRAGMA table_info(marketing_products)")
    pcols = {r[1] for r in await cur.fetchall()}
    if pcols and "stock" not in pcols:
        await db.execute(
            "ALTER TABLE marketing_products ADD COLUMN stock INTEGER NOT NULL DEFAULT 100"
        )


async def _seed_defaults() -> None:
    from .seed_templates import seed_production_email_templates

    await seed_production_email_templates()

    db = get_db()
    cur = await db.execute("SELECT COUNT(*) FROM auto_responder_rules")
    if (await cur.fetchone())[0] == 0:
        now = _now()
        await db.execute(
            """
            INSERT INTO auto_responder_rules
              (id, name, trigger_keywords, response_template, template_id, is_active, priority, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, 10, ?, ?)
            """,
            (
                _new_id("AR"),
                "Απάντηση προσφοράς",
                "προσφορά, offer, τιμή, price",
                "<p>Ευχαριστούμε για το ενδιαφέρον σας. Θα σας στείλουμε την καλύτερη προσφορά εντός 24 ωρών.</p>",
                "TPL-WELCOME",
                now,
                now,
            ),
        )
        await db.commit()

    await _seed_products_if_empty()


async def _seed_products_if_empty() -> None:
    db = get_db()
    cur = await db.execute("SELECT COUNT(*) FROM marketing_products")
    if (await cur.fetchone())[0] > 0:
        return
    products = [
        ("trip-1", "Ημερήσια στα Μετέωρα", 45.0, "/images/meteora.png", "Luxury Coach εκδρομή"),
        ("trip-2", "Απόδραση στην Πρωτεύουσα", 35.0, "/images/athens.png", "Premium Express"),
        ("trip-3", "Μαγευτικά Ιωάννινα", 28.0, "/images/ioannina.png", "Λίμνη Ιωαννίνων"),
    ]
    for i, (pid, title, price, img, desc) in enumerate(products):
        await db.execute(
            """
            INSERT INTO marketing_products (id, title, price, image_url, description, active, sort_order)
            VALUES (?, ?, ?, ?, ?, 1, ?)
            """,
            (pid, title, price, img, desc, i),
        )
    await db.commit()


def _row_template(row) -> dict:
    vars_raw = row["variables_json"] or "[]"
    try:
        variables = json.loads(vars_raw)
    except json.JSONDecodeError:
        variables = list(STANDARD_TEMPLATE_VARIABLES)
    return {
        "id": row["id"],
        "name": row["name"],
        "subject": row["subject"],
        "body_html": row["body_html"],
        "variables": variables,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _row_campaign(row) -> dict:
    stats = None
    if row["stats_json"]:
        try:
            stats = json.loads(row["stats_json"])
        except json.JSONDecodeError:
            stats = None
    keys = row.keys()
    return {
        "id": row["id"],
        "name": row["name"],
        "subject": row["subject"],
        "body_html": row["body_html"],
        "status": row["status"],
        "sent_at": row["sent_at"],
        "audience_filter": row["audience_filter"],
        "open_count": int(row["open_count"]) if "open_count" in keys and row["open_count"] is not None else 0,
        "click_count": int(row["click_count"]) if "click_count" in keys and row["click_count"] is not None else 0,
        "email_settings_id": row["email_settings_id"] if "email_settings_id" in keys else None,
        "preheader": row["preheader"] if "preheader" in keys else "",
        "blocks_json": row["blocks_json"] if "blocks_json" in keys else None,
        "stats": stats,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _row_rule(row) -> dict:
    keys = row.keys()
    return {
        "id": row["id"],
        "name": row["name"],
        "trigger_keywords": row["trigger_keywords"],
        "response_template": row["response_template"],
        "template_id": row["template_id"],
        "email_settings_id": row["email_settings_id"] if "email_settings_id" in keys else None,
        "is_active": bool(row["is_active"]),
        "priority": row["priority"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


# --- Templates ---

async def list_templates() -> list[dict]:
    db = get_db()
    cur = await db.execute("SELECT * FROM email_templates ORDER BY updated_at DESC")
    return [_row_template(r) for r in await cur.fetchall()]


async def get_template(template_id: str) -> dict | None:
    db = get_db()
    cur = await db.execute("SELECT * FROM email_templates WHERE id = ?", (template_id,))
    row = await cur.fetchone()
    return _row_template(row) if row else None


async def create_template(data: dict) -> dict:
    tid = _new_id("TPL")
    now = _now()
    variables = data.get("variables") or list(STANDARD_TEMPLATE_VARIABLES)
    db = get_db()
    await db.execute(
        """
        INSERT INTO email_templates (id, name, subject, body_html, variables_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            tid,
            data["name"],
            data.get("subject", ""),
            data.get("body_html", ""),
            json.dumps(variables, ensure_ascii=False),
            now,
            now,
        ),
    )
    await db.commit()
    return await get_template(tid)  # type: ignore[return-value]


async def update_template(template_id: str, patch: dict) -> dict | None:
    existing = await get_template(template_id)
    if not existing:
        return None
    merged = {**existing, **{k: v for k, v in patch.items() if v is not None}}
    db = get_db()
    await db.execute(
        """
        UPDATE email_templates
        SET name=?, subject=?, body_html=?, variables_json=?, updated_at=?
        WHERE id=?
        """,
        (
            merged["name"],
            merged["subject"],
            merged["body_html"],
            json.dumps(merged.get("variables", []), ensure_ascii=False),
            _now(),
            template_id,
        ),
    )
    await db.commit()
    return await get_template(template_id)


# --- Campaigns ---

async def list_campaigns() -> list[dict]:
    db = get_db()
    cur = await db.execute("SELECT * FROM email_campaigns ORDER BY updated_at DESC")
    return [_row_campaign(r) for r in await cur.fetchall()]


async def get_campaign(campaign_id: str) -> dict | None:
    db = get_db()
    cur = await db.execute("SELECT * FROM email_campaigns WHERE id = ?", (campaign_id,))
    row = await cur.fetchone()
    return _row_campaign(row) if row else None


async def create_campaign(data: dict) -> dict:
    cid = _new_id("CMP")
    now = _now()
    db = get_db()
    await db.execute(
        """
        INSERT INTO email_campaigns
          (id, name, subject, preheader, body_html, blocks_json, status, audience_filter, email_settings_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            cid,
            data["name"],
            data["subject"],
            data.get("preheader", ""),
            data.get("body_html", ""),
            data.get("blocks_json"),
            data.get("status", CAMPAIGN_STATUS_DRAFT),
            data.get("audience_filter", "all"),
            data.get("email_settings_id"),
            now,
            now,
        ),
    )
    await db.commit()
    return await get_campaign(cid)  # type: ignore[return-value]


async def update_campaign(campaign_id: str, patch: dict) -> dict | None:
    existing = await get_campaign(campaign_id)
    if not existing:
        return None
    merged = {**existing, **{k: v for k, v in patch.items() if v is not None}}
    db = get_db()
    await db.execute(
        """
        UPDATE email_campaigns
        SET name=?, subject=?, preheader=?, body_html=?, blocks_json=?, status=?,
            audience_filter=?, email_settings_id=?, updated_at=?
        WHERE id=?
        """,
        (
            merged["name"],
            merged["subject"],
            merged.get("preheader", ""),
            merged["body_html"],
            merged.get("blocks_json"),
            merged["status"],
            merged["audience_filter"],
            merged.get("email_settings_id"),
            _now(),
            campaign_id,
        ),
    )
    await db.commit()
    return await get_campaign(campaign_id)


async def delete_campaign(campaign_id: str) -> bool:
    existing = await get_campaign(campaign_id)
    if not existing:
        return False
    db = get_db()
    await db.execute("DELETE FROM campaign_send_log WHERE campaign_id = ?", (campaign_id,))
    await db.execute("DELETE FROM email_campaigns WHERE id = ?", (campaign_id,))
    await db.commit()
    return True


async def mark_campaign_sent(campaign_id: str, stats: dict) -> None:
    db = get_db()
    await db.execute(
        """
        UPDATE email_campaigns
        SET status='Sent', sent_at=?, stats_json=?, updated_at=?
        WHERE id=?
        """,
        (_now(), json.dumps(stats, ensure_ascii=False), _now(), campaign_id),
    )
    await db.commit()


# --- Auto-responder rules ---

async def list_auto_responder_rules(active_only: bool = False) -> list[dict]:
    db = get_db()
    q = "SELECT * FROM auto_responder_rules"
    if active_only:
        q += " WHERE is_active = 1"
    q += " ORDER BY priority ASC, updated_at DESC"
    cur = await db.execute(q)
    return [_row_rule(r) for r in await cur.fetchall()]


async def get_auto_responder_rule(rule_id: str) -> dict | None:
    db = get_db()
    cur = await db.execute("SELECT * FROM auto_responder_rules WHERE id = ?", (rule_id,))
    row = await cur.fetchone()
    return _row_rule(row) if row else None


async def create_auto_responder_rule(data: dict) -> dict:
    rid = _new_id("AR")
    now = _now()
    db = get_db()
    await db.execute(
        """
        INSERT INTO auto_responder_rules
          (id, name, trigger_keywords, response_template, template_id, email_settings_id, is_active, priority, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            rid,
            data["name"],
            data["trigger_keywords"],
            data["response_template"],
            data.get("template_id"),
            data.get("email_settings_id"),
            1 if data.get("is_active", True) else 0,
            data.get("priority", 100),
            now,
            now,
        ),
    )
    await db.commit()
    return await get_auto_responder_rule(rid)  # type: ignore[return-value]


async def update_auto_responder_rule(rule_id: str, patch: dict) -> dict | None:
    existing = await get_auto_responder_rule(rule_id)
    if not existing:
        return None
    merged = {**existing, **{k: v for k, v in patch.items() if v is not None}}
    if "is_active" in patch:
        merged["is_active"] = bool(patch["is_active"])
    db = get_db()
    await db.execute(
        """
        UPDATE auto_responder_rules
        SET name=?, trigger_keywords=?, response_template=?, template_id=?,
            is_active=?, priority=?, updated_at=?
        WHERE id=?
        """,
        (
            merged["name"],
            merged["trigger_keywords"],
            merged["response_template"],
            merged.get("template_id"),
            1 if merged["is_active"] else 0,
            merged["priority"],
            _now(),
            rule_id,
        ),
    )
    await db.commit()
    return await get_auto_responder_rule(rule_id)


async def delete_auto_responder_rule(rule_id: str) -> bool:
    db = get_db()
    cur = await db.execute("DELETE FROM auto_responder_rules WHERE id = ?", (rule_id,))
    await db.commit()
    return cur.rowcount > 0


async def log_inbound_processed(
    *,
    message_id: str | None,
    from_addr: str,
    subject: str,
    body_preview: str,
    matched_rule_id: str | None,
    auto_replied: bool,
) -> None:
    db = get_db()
    if message_id:
        cur = await db.execute(
            "SELECT id FROM inbound_email_log WHERE message_id = ?",
            (message_id,),
        )
        if await cur.fetchone():
            return
    await db.execute(
        """
        INSERT INTO inbound_email_log
          (id, message_id, from_addr, subject, body_preview, matched_rule_id, auto_replied, processed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            _new_id("IN"),
            message_id,
            from_addr,
            subject[:500] if subject else "",
            body_preview[:2000] if body_preview else "",
            matched_rule_id,
            1 if auto_replied else 0,
            _now(),
        ),
    )
    await db.commit()


# --- Products ---

async def list_active_products() -> list[dict]:
    db = get_db()
    cur = await db.execute(
        "SELECT * FROM marketing_products WHERE active = 1 ORDER BY sort_order ASC, title ASC"
    )
    rows = await cur.fetchall()
    return [
        {
            "id": r["id"],
            "title": r["title"],
            "price": float(r["price"]),
            "image_url": r["image_url"],
            "description": r["description"],
            "active": bool(r["active"]),
            "stock": int(r["stock"]) if "stock" in r.keys() and r["stock"] is not None else 100,
        }
        for r in rows
    ]
