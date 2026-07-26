from .db import get_db, row_to_booking
from .seed import trip_capacity


def _is_boardable(payment_status: str) -> bool:
    ps = (payment_status or "").upper()
    if "CANCEL" in ps or "REFUND" in ps:
        return False
    return "PAID" in ps or "DEPOSIT" in ps or "PARTIAL" in ps


def _booking_ref(passenger: dict) -> str:
    spec = passenger.get("special_requirements") or {}
    return str(spec.get("pnr") or passenger.get("ticket_ref") or passenger.get("id") or "").strip()


def _passenger_payload(passenger: dict, *, boarded: bool = False) -> dict:
    seats = str(passenger.get("seat_number") or "").strip()
    seat_count = len([s for s in seats.replace(";", ",").split(",") if s.strip()]) or 1
    row = {
        "booking_id": passenger["id"],
        "booking_ref": _booking_ref(passenger),
        "passenger_name": passenger["customer_name"],
        "seat_number": passenger["seat_number"],
        "seat_count": seat_count,
        "phone": passenger.get("phone"),
        "special_requirements": passenger.get("special_requirements") or {},
    }
    if boarded:
        row["boarded_at"] = passenger.get("boarded_at")
    return row


async def get_boarding_manifest(trip_id: int) -> dict:
    db = get_db()
    cur = await db.execute(
        """
        SELECT * FROM ticket_bookings
        WHERE trip_id = ?
        ORDER BY seat_number
        """,
        (trip_id,),
    )
    rows = await cur.fetchall()
    passengers = [
        p for p in (row_to_booking(r) for r in rows) if _is_boardable(p.get("payment_status") or "")
    ]
    capacity = trip_capacity(trip_id)

    boarded = [p for p in passengers if p["check_in_status"] == "BOARDED"]
    missing = [p for p in passengers if p["check_in_status"] != "BOARDED"]
    conflicts = [_passenger_payload(p, boarded=True) for p in boarded]

    trip_title = ""
    destination = ""
    meeting_point = ""
    try:
        from travel_platform.operations.trip_ops_store import get_trip_ops
        from travel_platform.telemetry.trip_title_resolve import resolve_trip_title

        ops = get_trip_ops(trip_id) or {}
        trip_title = await resolve_trip_title(trip_id, preferred=ops.get("title"))
        destination = str(ops.get("destination") or "").strip()
        meeting_point = str(ops.get("meeting_point") or "").strip()
        if ops.get("total_seats"):
            try:
                capacity = max(int(ops["total_seats"]), capacity)
            except (TypeError, ValueError):
                pass
    except Exception:
        trip_title = f"Εκδρομή #{trip_id}"

    return {
        "trip_id": trip_id,
        "trip_title": trip_title,
        "destination": destination,
        "meeting_point": meeting_point,
        "capacity": capacity,
        "booked_count": len(passengers),
        "boarded_count": len(boarded),
        "progress_label": f"{len(boarded)}/{capacity}",
        "progress_percent": round(100 * len(boarded) / capacity, 1) if capacity else 0,
        "missing_passengers": [_passenger_payload(p) for p in missing],
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
