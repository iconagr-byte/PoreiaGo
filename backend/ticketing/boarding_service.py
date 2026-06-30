from .db import get_db, row_to_booking
from .seed import trip_capacity


async def get_boarding_manifest(trip_id: int) -> dict:
    db = get_db()
    cur = await db.execute(
        """
        SELECT * FROM ticket_bookings
        WHERE trip_id = ? AND payment_status LIKE '%PAID%'
        ORDER BY seat_number
        """,
        (trip_id,),
    )
    rows = await cur.fetchall()
    passengers = [row_to_booking(r) for r in rows]
    capacity = trip_capacity(trip_id)

    boarded = [p for p in passengers if p["check_in_status"] == "BOARDED"]
    missing = [p for p in passengers if p["check_in_status"] != "BOARDED"]
    conflicts = [
        {
            "booking_id": p["id"],
            "passenger_name": p["customer_name"],
            "seat_number": p["seat_number"],
            "boarded_at": p.get("boarded_at"),
        }
        for p in boarded
    ]

    return {
        "trip_id": trip_id,
        "capacity": capacity,
        "booked_count": len(passengers),
        "boarded_count": len(boarded),
        "progress_label": f"{len(boarded)}/{capacity}",
        "progress_percent": round(100 * len(boarded) / capacity, 1) if capacity else 0,
        "missing_passengers": [
            {
                "booking_id": p["id"],
                "passenger_name": p["customer_name"],
                "seat_number": p["seat_number"],
                "phone": p.get("phone"),
                "special_requirements": p.get("special_requirements") or {},
            }
            for p in missing
        ],
        "boarded_passengers": conflicts,
        "alerts": _build_alerts(len(boarded), capacity, missing),
    }


def _build_alerts(boarded: int, capacity: int, missing: list) -> list[dict]:
    alerts = []
    if boarded >= capacity:
        alerts.append({"level": "warning", "text": "Πλήρης χωρητικότητα — έλεγχος overbooking."})
    if len(missing) > 0 and boarded / max(capacity, 1) > 0.8:
        alerts.append(
            {
                "level": "info",
                "text": f"{len(missing)} επιβάτες δεν έχουν επιβιβαστεί (no-show risk).",
            }
        )
    return alerts
