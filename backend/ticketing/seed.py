import json
import uuid

from .db import get_db, init_ticketing_db


SEED_ROWS = [
    {
        "id": "B-1029",
        "trip_id": 1,
        "customer_name": "John Doe",
        "seat_number": "4A",
        "payment_status": "PAID",
        "check_in_status": "NONE",
        "special_requirements": {"needs_assistance": False, "allergies": [], "notes": "Window seat"},
        "phone": "+306941234567",
        "departure_at": "2026-06-15T08:00:00",
    },
    {
        "id": "B-1030",
        "trip_id": 1,
        "customer_name": "Maria Papadopoulou",
        "seat_number": "2B",
        "payment_status": "PAID",
        "check_in_status": "NONE",
        "special_requirements": {"needs_assistance": True, "allergies": ["nuts"], "notes": "Vegetarian meal"},
        "phone": "+306979876543",
        "departure_at": "2026-06-15T08:00:00",
    },
    {
        "id": "B-1031",
        "trip_id": 2,
        "customer_name": "George K.",
        "seat_number": "1A",
        "payment_status": "PENDING",
        "check_in_status": "NONE",
        "special_requirements": {},
        "phone": "+306934445555",
        "departure_at": "2026-06-16T10:00:00",
    },
]

TRIP_CAPACITY = {1: 45, 2: 32, 3: 22}


async def seed_if_empty() -> None:
    db = get_db()
    cur = await db.execute("SELECT COUNT(*) AS c FROM ticket_bookings")
    row = await cur.fetchone()
    if row and row[0] > 0:
        return

    for item in SEED_ROWS:
        ticket_ref = str(uuid.uuid4())
        await db.execute(
            """
            INSERT INTO ticket_bookings (
                id, trip_id, ticket_ref, customer_name, seat_number,
                payment_status, check_in_status, special_requirements,
                phone, departure_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                item["id"],
                item["trip_id"],
                ticket_ref,
                item["customer_name"],
                item["seat_number"],
                item["payment_status"],
                item["check_in_status"],
                json.dumps(item["special_requirements"]),
                item["phone"],
                item["departure_at"],
            ),
        )
    await db.commit()


def trip_capacity(trip_id: int) -> int:
    return TRIP_CAPACITY.get(trip_id, 45)
