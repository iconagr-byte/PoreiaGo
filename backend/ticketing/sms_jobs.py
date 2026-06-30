"""
Pre-departure SMS: if not BOARDED within N minutes of departure, notify passenger.
Wire to Twilio/Viber in production via background worker (Celery/APScheduler).
"""

from datetime import datetime, timedelta, timezone

from .db import get_db, row_to_booking


async def find_passengers_for_pre_departure_sms(
    trip_id: int,
    minutes_before: int = 5,
) -> list[dict]:
    db = get_db()
    cur = await db.execute(
        """
        SELECT * FROM ticket_bookings
        WHERE trip_id = ?
          AND payment_status LIKE '%PAID%'
          AND check_in_status != 'BOARDED'
        """,
        (trip_id,),
    )
    rows = await cur.fetchall()
    now = datetime.now(timezone.utc)
    due = []
    for row in rows:
        b = row_to_booking(row)
        dep = datetime.fromisoformat(b["departure_at"].replace("Z", "+00:00"))
        if dep.tzinfo is None:
            dep = dep.replace(tzinfo=timezone.utc)
        window_start = dep - timedelta(minutes=minutes_before)
        if window_start <= now < dep:
            due.append(
                {
                    "booking_id": b["id"],
                    "phone": b["phone"],
                    "template": "pre_departure_where_are_you",
                    "message_el": (
                        f"Γεια σας {b['customer_name']}, η αναχώρηση για την εκδρομή "
                        f"είναι σε {minutes_before} λεπτά. Παρακαλούμε παρουσιαστείτε στο σημείο επιβίβασης."
                    ),
                }
            )
    return due


async def dispatch_pre_departure_sms(trip_id: int, minutes_before: int = 5) -> dict:
    """Notify passengers not yet boarded — SMS via dispatcher (log + optional provider)."""
    from travel_platform.notifications.dispatcher import send_sms

    targets = await find_passengers_for_pre_departure_sms(trip_id, minutes_before)
    sent = 0
    for t in targets:
        if t.get("phone"):
            await send_sms(t["phone"], t["message_el"])
            sent += 1
    return {
        "trip_id": trip_id,
        "queued": len(targets),
        "sent": sent,
        "targets": targets,
        "status": "dispatched" if sent else "no_phones",
    }


async def scan_all_trips_pre_departure_sms(minutes_before: int = 5) -> dict:
    db = get_db()
    cur = await db.execute("SELECT DISTINCT trip_id FROM ticket_bookings")
    rows = await cur.fetchall()
    stats = {"trips": 0, "sent": 0, "queued": 0}
    for row in rows:
        trip_id = int(row[0])
        stats["trips"] += 1
        result = await dispatch_pre_departure_sms(trip_id, minutes_before)
        stats["sent"] += result.get("sent", 0)
        stats["queued"] += result.get("queued", 0)
    return stats
