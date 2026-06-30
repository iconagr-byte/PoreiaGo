"""Customer bookings — SQLite persistence (My Wallet + Control Panel sync)."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from .db import get_db


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _row_to_booking(row) -> dict:
    try:
        data = json.loads(row["payload_json"])
    except (TypeError, json.JSONDecodeError):
        data = {}
    data.setdefault("id", row["id"])
    data.setdefault("email", row["customer_email"])
    data.setdefault("customerId", row["customer_id"])
    return data


async def list_all_bookings() -> list[dict]:
    db = get_db()
    cursor = await db.execute(
        "SELECT * FROM customer_bookings ORDER BY updated_at DESC"
    )
    rows = await cursor.fetchall()
    return [_row_to_booking(r) for r in rows]


async def list_bookings_for_email(email: str) -> list[dict]:
    key = email.strip().lower()
    db = get_db()
    cursor = await db.execute(
        "SELECT * FROM customer_bookings WHERE customer_email = ? ORDER BY updated_at DESC",
        (key,),
    )
    rows = await cursor.fetchall()
    return [_row_to_booking(r) for r in rows]


async def get_booking(booking_id: str) -> dict | None:
    db = get_db()
    cursor = await db.execute(
        "SELECT * FROM customer_bookings WHERE id = ?",
        (booking_id,),
    )
    row = await cursor.fetchone()
    return _row_to_booking(row) if row else None


async def upsert_booking(
    booking: dict,
    *,
    customer_email: str | None = None,
    customer_id: str | None = None,
) -> dict:
    booking_id = str(booking.get("id") or "").strip()
    if not booking_id:
        raise ValueError("Booking id is required")

    email = (
        customer_email
        or booking.get("email")
        or booking.get("passenger_email")
        or ""
    ).strip().lower()
    if not email or "@" not in email:
        raise ValueError("Booking email is required")

    cid = customer_id or booking.get("customerId") or booking.get("customer_id")
    payload = dict(booking)
    payload["email"] = email
    if cid:
        payload["customerId"] = cid

    try:
        from travel_platform.telemetry.passenger_track_links import enrich_booking_passenger_track

        payload = enrich_booking_passenger_track(payload)
    except Exception:
        pass

    now = _now_iso()
    db = get_db()
    cursor = await db.execute(
        "SELECT created_at FROM customer_bookings WHERE id = ?",
        (booking_id,),
    )
    existing = await cursor.fetchone()
    created = existing["created_at"] if existing else now

    await db.execute(
        """
        INSERT INTO customer_bookings
          (id, customer_email, customer_id, payload_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          customer_email = excluded.customer_email,
          customer_id = excluded.customer_id,
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at
        """,
        (booking_id, email, cid, json.dumps(payload, ensure_ascii=False), created, now),
    )
    await db.commit()
    saved = await get_booking(booking_id)
    return saved  # type: ignore[return-value]


async def upsert_many_for_customer(
    email: str,
    customer_id: str | None,
    bookings: list[dict],
) -> list[dict]:
    key = email.strip().lower()
    for booking in bookings:
        b_email = str(booking.get("email") or "").strip().lower()
        if b_email and b_email != key:
            raise ValueError(f"Booking {booking.get('id')} belongs to another customer")
        await upsert_booking(
            {**booking, "email": key},
            customer_email=key,
            customer_id=customer_id or booking.get("customerId"),
        )
    return await list_bookings_for_email(key)


async def seed_customer_bookings_if_empty() -> None:
    db = get_db()
    cur = await db.execute("SELECT COUNT(*) AS c FROM customer_bookings")
    row = await cur.fetchone()
    if row and row[0] > 0:
        return

    seed = [
        {
            "id": "B-1029",
            "customerId": "CUST-001",
            "customerName": "John Doe",
            "tripTitle": "Ημερήσια στα Μετέωρα",
            "tripId": 1,
            "date": "2026-06-15",
            "time": "08:00",
            "seats": ["4A"],
            "seat": "4A",
            "price": 45.0,
            "status": "Επιβεβαιωμένη",
            "checkInStatus": "NONE",
            "phone": "+30 694 123 4567",
            "email": "john@example.com",
            "paymentStatus": "PAID (Credit Card)",
            "pnr": "MET26JDOE8A",
            "basePrice": 36.29,
            "taxes": 8.71,
            "bookingSource": "Website (B2C)",
        },
        {
            "id": "B-1030",
            "customerId": "CUST-002",
            "customerName": "Maria Papadopoulou",
            "tripTitle": "Απόδραση στην Πρωτεύουσα",
            "tripId": 2,
            "date": "2026-06-16",
            "time": "09:30",
            "seats": ["2B", "2C"],
            "seat": "2B, 2C",
            "price": 90.0,
            "status": "Επιβεβαιωμένη",
            "checkInStatus": "NONE",
            "phone": "+30 697 987 6543",
            "email": "maria@example.com",
            "paymentStatus": "PAID (PayPal)",
            "pnr": "ATH26MPAP2C",
            "basePrice": 72.58,
            "taxes": 17.42,
            "bookingSource": "Phone Call",
        },
        {
            "id": "B-1031",
            "customerId": "CUST-003",
            "customerName": "George K.",
            "tripTitle": "Μαγευτικά Ιωάννινα",
            "tripId": 3,
            "date": "2026-06-17",
            "time": "11:00",
            "seats": ["1A"],
            "seat": "1A",
            "price": 65.0,
            "status": "Εκκρεμής",
            "checkInStatus": "NONE",
            "phone": "+30 693 444 5555",
            "email": "george@example.com",
            "paymentStatus": "PENDING",
            "paymentMethod": "Εκκρεμής πληρωμή",
            "pnr": "IOA26GEO1A",
            "basePrice": 52.42,
            "taxes": 12.58,
            "bookingSource": "B2B Partner",
        },
        {
            "id": "B-0995",
            "customerId": "CUST-001",
            "customerName": "John Doe",
            "tripTitle": "3ήμερο Ναύπλιο",
            "tripId": 1,
            "date": "2026-05-10",
            "time": "07:30",
            "seats": ["6C"],
            "seat": "6C",
            "price": 120.0,
            "status": "Ολοκληρώθηκε",
            "checkInStatus": "CHECKED_IN",
            "checkedIn": True,
            "phone": "+30 694 123 4567",
            "email": "john@example.com",
            "paymentStatus": "PAID (Cash)",
            "pnr": "NAF26JDOE6C",
            "basePrice": 96.77,
            "taxes": 23.23,
            "bookingSource": "Office Walk-in",
        },
    ]

    for booking in seed:
        await upsert_booking(booking)
