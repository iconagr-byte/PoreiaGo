"""Mirror SaaS / checkout bookings into SQLite for rotating QR + driver scan."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from .db import get_db, row_to_booking


async def upsert_ticket_booking(
    *,
    local_id: str,
    trip_id: int,
    customer_name: str,
    seat_number: str,
    payment_status: str = "PAID",
    phone: str | None = None,
    departure_at: str | None = None,
    saas_booking_id: str | None = None,
    email: str | None = None,
    special_requirements: dict | None = None,
) -> dict:
    db = get_db()
    dep = departure_at or datetime.now(timezone.utc).isoformat()
    spec = special_requirements or {}
    if email:
        spec["email"] = email
    if saas_booking_id:
        spec["saas_booking_id"] = saas_booking_id

    cur = await db.execute(
        "SELECT id, ticket_ref FROM ticket_bookings WHERE id = ? OR saas_booking_id = ? LIMIT 1",
        (local_id, saas_booking_id or ""),
    )
    existing = await cur.fetchone()
    ticket_ref = existing["ticket_ref"] if existing else str(uuid.uuid4())

    if existing:
        await db.execute(
            """
            UPDATE ticket_bookings SET
                trip_id = ?, customer_name = ?, seat_number = ?,
                payment_status = ?, phone = ?, departure_at = ?,
                saas_booking_id = ?, special_requirements = ?
            WHERE id = ?
            """,
            (
                trip_id,
                customer_name,
                seat_number,
                payment_status,
                phone or "",
                dep,
                saas_booking_id,
                json.dumps(spec),
                existing["id"],
            ),
        )
        booking_id = existing["id"]
    else:
        booking_id = local_id
        await db.execute(
            """
            INSERT INTO ticket_bookings (
                id, trip_id, ticket_ref, customer_name, seat_number,
                payment_status, check_in_status, special_requirements,
                phone, departure_at, saas_booking_id
            ) VALUES (?, ?, ?, ?, ?, ?, 'NONE', ?, ?, ?, ?)
            """,
            (
                booking_id,
                trip_id,
                ticket_ref,
                customer_name,
                seat_number,
                payment_status,
                json.dumps(spec),
                phone or "",
                dep,
                saas_booking_id,
            ),
        )
    await db.commit()
    cur2 = await db.execute("SELECT * FROM ticket_bookings WHERE id = ?", (booking_id,))
    row = await cur2.fetchone()
    return row_to_booking(row) if row else {}
