"""Customer bookings — SQLite persistence (My Wallet + Control Panel sync)."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from .db import get_db


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _normalize_tenant(tenant_id: str | None) -> str | None:
    tid = str(tenant_id or "").strip()
    return tid or None


def _row_to_booking(row) -> dict:
    try:
        data = json.loads(row["payload_json"])
    except (TypeError, json.JSONDecodeError):
        data = {}
    data.setdefault("id", row["id"])
    data.setdefault("email", row["customer_email"])
    data.setdefault("customerId", row["customer_id"])
    row_tid = None
    try:
        row_tid = row["tenant_id"]
    except (KeyError, IndexError):
        row_tid = None
    tid = _normalize_tenant(row_tid) or _normalize_tenant(
        data.get("tenant_id") or data.get("tenantId")
    )
    if tid:
        data["tenant_id"] = tid
        data["tenantId"] = tid
    return data


def _booking_tenant(booking: dict) -> str | None:
    return _normalize_tenant(booking.get("tenant_id") or booking.get("tenantId"))


async def list_all_bookings() -> list[dict]:
    db = get_db()
    cursor = await db.execute(
        "SELECT * FROM customer_bookings ORDER BY updated_at DESC"
    )
    rows = await cursor.fetchall()
    return [_row_to_booking(r) for r in rows]


async def list_bookings_for_email(
    email: str,
    tenant_id: str | None = None,
) -> list[dict]:
    """List wallet bookings for email, scoped to one office when tenant_id is set."""
    key = email.strip().lower()
    tid = _normalize_tenant(tenant_id)
    db = get_db()
    if tid:
        # Strict office seal — never surface NULL/foreign tenant rows.
        cursor = await db.execute(
            """
            SELECT * FROM customer_bookings
            WHERE customer_email = ?
              AND tenant_id = ?
            ORDER BY updated_at DESC
            """,
            (key, tid),
        )
    else:
        cursor = await db.execute(
            "SELECT * FROM customer_bookings WHERE customer_email = ? ORDER BY updated_at DESC",
            (key,),
        )
    rows = await cursor.fetchall()
    items = [_row_to_booking(r) for r in rows]
    if tid:
        return [b for b in items if _booking_tenant(b) == tid]
    return items


async def get_booking(booking_id: str, tenant_id: str | None = None) -> dict | None:
    db = get_db()
    cursor = await db.execute(
        "SELECT * FROM customer_bookings WHERE id = ?",
        (booking_id,),
    )
    row = await cursor.fetchone()
    if not row:
        return None
    booking = _row_to_booking(row)
    tid = _normalize_tenant(tenant_id)
    if tid:
        btid = _booking_tenant(booking)
        # Legacy rows without tenant stay visible only until backfilled — deny cross-office.
        if btid and btid != tid:
            return None
        if not btid:
            # Unscoped legacy: allow only when explicitly requested without tenant,
            # or treat as belonging to first office that claims it via email list.
            # Safer default: hide from office-scoped wallet until tenant is stamped.
            return None
    return booking


async def upsert_booking(
    booking: dict,
    *,
    customer_email: str | None = None,
    customer_id: str | None = None,
    tenant_id: str | None = None,
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
    tid = _normalize_tenant(tenant_id) or _booking_tenant(booking)
    payload = dict(booking)
    payload["email"] = email
    if cid:
        payload["customerId"] = cid
    if tid:
        payload["tenant_id"] = tid
        payload["tenantId"] = tid

    try:
        from travel_platform.telemetry.passenger_track_links import enrich_booking_passenger_track

        payload = enrich_booking_passenger_track(payload)
    except Exception:
        pass

    now = _now_iso()
    db = get_db()
    cursor = await db.execute(
        "SELECT created_at, tenant_id, customer_email FROM customer_bookings WHERE id = ?",
        (booking_id,),
    )
    existing = await cursor.fetchone()
    created = existing["created_at"] if existing else now
    if existing:
        existing_email = str(existing["customer_email"] or "").strip().lower()
        if existing_email and existing_email != email:
            raise ValueError("Η κράτηση ανήκει σε άλλο λογαριασμό")
        try:
            existing_tid = _normalize_tenant(existing["tenant_id"])
        except (KeyError, IndexError):
            existing_tid = None
        if existing_tid and tid and existing_tid != tid:
            raise ValueError("Η κράτηση ανήκει σε άλλο γραφείο")
        if existing and not tid:
            tid = existing_tid

    await db.execute(
        """
        INSERT INTO customer_bookings
          (id, customer_email, customer_id, tenant_id, payload_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          customer_email = excluded.customer_email,
          customer_id = excluded.customer_id,
          tenant_id = COALESCE(excluded.tenant_id, customer_bookings.tenant_id),
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at
        """,
        (booking_id, email, cid, tid, json.dumps(payload, ensure_ascii=False), created, now),
    )
    await db.commit()
    saved = await get_booking(booking_id, tenant_id=None)
    # get_booking without tenant returns row even if unscoped — use direct read for save result
    if saved is None:
        cursor = await db.execute(
            "SELECT * FROM customer_bookings WHERE id = ?",
            (booking_id,),
        )
        row = await cursor.fetchone()
        saved = _row_to_booking(row) if row else payload
    return saved  # type: ignore[return-value]


async def upsert_many_for_customer(
    email: str,
    customer_id: str | None,
    bookings: list[dict],
    tenant_id: str | None = None,
) -> list[dict]:
    key = email.strip().lower()
    tid = _normalize_tenant(tenant_id)
    for booking in bookings:
        b_email = str(booking.get("email") or "").strip().lower()
        if b_email and b_email != key:
            raise ValueError(f"Booking {booking.get('id')} belongs to another customer")
        stamped = {**booking, "email": key}
        if tid:
            stamped["tenant_id"] = tid
            stamped["tenantId"] = tid
        await upsert_booking(
            stamped,
            customer_email=key,
            customer_id=customer_id or booking.get("customerId"),
            tenant_id=tid,
        )
    return await list_bookings_for_email(key, tenant_id=tid)


async def delete_booking_for_customer(
    booking_id: str,
    *,
    email: str,
    tenant_id: str | None = None,
) -> bool:
    """Delete one wallet cache row — must match customer email (+ optional office)."""
    bid = str(booking_id or "").strip()
    key = str(email or "").strip().lower()
    if not bid or not key:
        return False
    tid = _normalize_tenant(tenant_id)
    db = get_db()
    if tid:
        cur = await db.execute(
            """
            DELETE FROM customer_bookings
            WHERE id = ? AND customer_email = ? AND tenant_id = ?
            """,
            (bid, key, tid),
        )
    else:
        cur = await db.execute(
            "DELETE FROM customer_bookings WHERE id = ? AND customer_email = ?",
            (bid, key),
        )
    await db.commit()
    return bool(cur.rowcount)


async def delete_booking_by_aliases(
    aliases: list[str],
    *,
    email: str | None = None,
    tenant_id: str | None = None,
) -> int:
    """
    Hard-delete wallet cache rows matching any id / saas id / PNR alias.
    Used when desktop permanently deletes a booking.
    """
    keys = [str(a).strip() for a in (aliases or []) if str(a or "").strip()]
    if not keys:
        return 0
    tid = _normalize_tenant(tenant_id)
    email_key = str(email or "").strip().lower() or None
    db = get_db()
    # Load candidate rows then filter aliases in Python (payload may hold saasBookingId).
    if tid and email_key:
        cur = await db.execute(
            "SELECT * FROM customer_bookings WHERE customer_email = ? AND tenant_id = ?",
            (email_key, tid),
        )
    elif email_key:
        cur = await db.execute(
            "SELECT * FROM customer_bookings WHERE customer_email = ?",
            (email_key,),
        )
    elif tid:
        cur = await db.execute(
            "SELECT * FROM customer_bookings WHERE tenant_id = ?",
            (tid,),
        )
    else:
        cur = await db.execute("SELECT * FROM customer_bookings")
    rows = await cur.fetchall()
    alias_set = {k for k in keys} | {k.upper() for k in keys} | {k.lower() for k in keys}
    deleted = 0
    for row in rows:
        booking = _row_to_booking(row)
        candidates = {
            str(booking.get("id") or ""),
            str(booking.get("saasBookingId") or ""),
            str(booking.get("pnr") or ""),
            str(booking.get("ticketRef") or ""),
            str(row["id"] or ""),
        }
        if not (candidates & alias_set):
            continue
        await db.execute("DELETE FROM customer_bookings WHERE id = ?", (row["id"],))
        deleted += 1
    if deleted:
        await db.commit()
    return deleted


async def seed_customer_bookings_if_empty() -> None:
    db = get_db()
    cur = await db.execute("SELECT COUNT(*) AS c FROM customer_bookings")
    row = await cur.fetchone()
    if row and row[0] > 0:
        return

    from travel_platform.settings.drivers_store import DEMO_TENANT_ID

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
            "tenant_id": DEMO_TENANT_ID,
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
            "tenant_id": DEMO_TENANT_ID,
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
            "tenant_id": DEMO_TENANT_ID,
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
            "tenant_id": DEMO_TENANT_ID,
        },
    ]

    for booking in seed:
        await upsert_booking(booking, tenant_id=DEMO_TENANT_ID)
