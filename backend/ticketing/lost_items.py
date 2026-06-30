"""Lost & found reports — My Wallet → Control Panel."""

from __future__ import annotations

from datetime import datetime, timezone

from .db import get_db

VALID_STATUSES = frozenset({"OPEN", "FOUND", "CLOSED"})


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _row_to_item(row) -> dict:
    return {
        "id": row["id"],
        "customerEmail": row["customer_email"],
        "customerId": row["customer_id"],
        "customerName": row["customer_name"],
        "itemCategory": row["item_category"],
        "description": row["description"],
        "lastSeenLocation": row["last_seen_location"],
        "status": row["status"],
        "dateReported": row["date_reported"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


async def _next_id() -> str:
    db = get_db()
    cursor = await db.execute(
        "SELECT id FROM lost_items WHERE id LIKE 'LF-%' ORDER BY id DESC LIMIT 1"
    )
    row = await cursor.fetchone()
    if not row:
        return "LF-1001"
    try:
        num = int(str(row["id"]).split("-", 1)[1])
    except (IndexError, ValueError):
        num = 1000
    return f"LF-{num + 1}"


async def list_all_lost_items() -> list[dict]:
    db = get_db()
    cursor = await db.execute(
        "SELECT * FROM lost_items ORDER BY date_reported DESC"
    )
    rows = await cursor.fetchall()
    return [_row_to_item(r) for r in rows]


async def list_lost_items_for_email(email: str) -> list[dict]:
    key = email.strip().lower()
    db = get_db()
    cursor = await db.execute(
        "SELECT * FROM lost_items WHERE customer_email = ? ORDER BY date_reported DESC",
        (key,),
    )
    rows = await cursor.fetchall()
    return [_row_to_item(r) for r in rows]


async def get_lost_item(item_id: str) -> dict | None:
    db = get_db()
    cursor = await db.execute("SELECT * FROM lost_items WHERE id = ?", (item_id,))
    row = await cursor.fetchone()
    return _row_to_item(row) if row else None


async def create_lost_item(
    *,
    customer_email: str,
    customer_name: str,
    customer_id: str | None,
    item_category: str,
    description: str,
    last_seen_location: str,
) -> dict:
    email = customer_email.strip().lower()
    if not email or "@" not in email:
        raise ValueError("Invalid customer email")
    category = (item_category or "").strip()
    desc = (description or "").strip()
    location = (last_seen_location or "").strip()
    if not category or not desc or not location:
        raise ValueError("Συμπληρώστε κατηγορία, περιγραφή και τοποθεσία")

    item_id = await _next_id()
    now = _now_iso()
    db = get_db()
    await db.execute(
        """
        INSERT INTO lost_items (
          id, customer_email, customer_id, customer_name,
          item_category, description, last_seen_location,
          status, date_reported, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?)
        """,
        (
            item_id,
            email,
            customer_id,
            (customer_name or email.split("@")[0]).strip(),
            category,
            desc,
            location,
            now,
            now,
            now,
        ),
    )
    await db.commit()
    item = await get_lost_item(item_id)
    assert item is not None
    return item


async def update_lost_item_status(item_id: str, status: str) -> dict:
    st = (status or "").strip().upper()
    if st not in VALID_STATUSES:
        raise ValueError("Invalid status")
    db = get_db()
    now = _now_iso()
    cursor = await db.execute(
        "UPDATE lost_items SET status = ?, updated_at = ? WHERE id = ?",
        (st, now, item_id),
    )
    await db.commit()
    if cursor.rowcount == 0:
        raise ValueError("Item not found")
    item = await get_lost_item(item_id)
    assert item is not None
    return item


async def seed_lost_items_if_empty() -> None:
    db = get_db()
    cursor = await db.execute("SELECT COUNT(*) AS c FROM lost_items")
    row = await cursor.fetchone()
    if row and row["c"] > 0:
        return
    seeds = [
        {
            "id": "LF-1001",
            "customer_email": "giorgos@example.com",
            "customer_name": "Γιώργος Παπαδόπουλος",
            "item_category": "Ηλεκτρονικά",
            "description": "Μαύρο iPhone 13 με μπλε θήκη. Το άφησα στη θέση μου (12Α) στο δρομολόγιο για Μετέωρα.",
            "last_seen_location": "Aero VIP 1 (Δρομολόγιο Μετέωρα)",
            "status": "OPEN",
            "date_reported": "2026-06-01T09:30:00+00:00",
        },
        {
            "id": "LF-1002",
            "customer_email": "maria@example.com",
            "customer_name": "Μαρία Αντωνίου",
            "item_category": "Προσωπικά Έγγραφα",
            "description": "Πράσινο πορτοφόλι με ταυτότητα και κάρτες.",
            "last_seen_location": "Στάση: Δελφοί",
            "status": "FOUND",
            "date_reported": "2026-05-28T14:15:00+00:00",
        },
        {
            "id": "LF-1003",
            "customer_email": "nikos@example.com",
            "customer_name": "Νίκος Κώστα",
            "item_category": "Ρούχα",
            "description": "Γκρι ζακέτα φόρμας (Nike).",
            "last_seen_location": "City Cruiser 3",
            "status": "CLOSED",
            "date_reported": "2026-05-10T18:45:00+00:00",
        },
    ]
    now = _now_iso()
    for s in seeds:
        await db.execute(
            """
            INSERT INTO lost_items (
              id, customer_email, customer_id, customer_name,
              item_category, description, last_seen_location,
              status, date_reported, created_at, updated_at
            ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                s["id"],
                s["customer_email"],
                s["customer_name"],
                s["item_category"],
                s["description"],
                s["last_seen_location"],
                s["status"],
                s["date_reported"],
                now,
                now,
            ),
        )
    await db.commit()
