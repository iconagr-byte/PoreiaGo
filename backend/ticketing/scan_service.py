"""Scan-to-boarding: target <200ms (SQLite indexed lookup + single transaction)."""

from datetime import datetime, timezone

from .db import get_db, row_to_booking, transaction
from .bt1_token import verify_bt1_token
from .qr_rotating import verify_rotating_jwt


def is_paid(payment_status: str) -> bool:
    return "PAID" in (payment_status or "").upper()


def is_cancelled(booking: dict) -> bool:
    ps = (booking.get("payment_status") or "").upper()
    cs = (booking.get("check_in_status") or "").upper()
    return "CANCELLED" in ps or cs == "CANCELLED"


async def get_booking_by_ref(ticket_ref: str) -> dict | None:
    db = get_db()
    cur = await db.execute(
        "SELECT * FROM ticket_bookings WHERE ticket_ref = ? LIMIT 1",
        (ticket_ref,),
    )
    row = await cur.fetchone()
    return row_to_booking(row) if row else None


async def get_booking_by_id(booking_id: str) -> dict | None:
    db = get_db()
    cur = await db.execute(
        "SELECT * FROM ticket_bookings WHERE id = ? OR saas_booking_id = ? LIMIT 1",
        (booking_id, booking_id),
    )
    row = await cur.fetchone()
    return row_to_booking(row) if row else None


def scan_response_success(booking: dict) -> dict:
    spec = booking.get("special_requirements") or {}
    return {
        "result": "SUCCESS",
        "booking_id": booking["id"],
        "passenger_name": booking["customer_name"],
        "seat_number": booking["seat_number"],
        "special_requirements": {
            "needs_assistance": bool(spec.get("needs_assistance")),
            "allergies": spec.get("allergies") or [],
            "notes": spec.get("notes") or "",
        },
        "message": "Επιτυχής επιβίβαση",
    }


def scan_response_failure(reason: str, message: str, booking: dict | None = None) -> dict:
    out = {
        "result": "FAILURE",
        "reason": reason,
        "message": message,
    }
    if booking:
        out["passenger_name"] = booking.get("customer_name")
        out["seat_number"] = booking.get("seat_number")
        out["booking_id"] = booking.get("id")
    return out


async def _board_booking(
    db,
    booking: dict,
    *,
    trip_id: int,
    scan_step: int | None = None,
) -> dict:
    if booking["trip_id"] != trip_id:
        return scan_response_failure(
            "TRIP_MISMATCH",
            "Το εισιτήριο δεν ανήκει σε αυτή την εκδρομή.",
            booking,
        )

    if not is_paid(booking["payment_status"]):
        return scan_response_failure(
            "NOT_PAID",
            "Η κράτηση δεν έχει εξοφληθεί.",
            booking,
        )

    if is_cancelled(booking):
        return scan_response_failure(
            "CANCELLED",
            "Η κράτηση έχει ακυρωθεί.",
            booking,
        )

    if booking["check_in_status"] == "BOARDED":
        return scan_response_failure(
            "ALREADY_SCANNED",
            "Το εισιτήριο έχει ήδη σαρωθεί.",
            booking,
        )

    if scan_step is not None and booking.get("last_scan_step") == scan_step:
        return scan_response_failure(
            "REPLAY_DETECTED",
            "Επανάληψη σάρωσης (replay).",
            booking,
        )

    now = datetime.now(timezone.utc).isoformat()
    await db.execute(
        """
        UPDATE ticket_bookings
        SET check_in_status = 'BOARDED',
            last_scan_step = ?,
            boarded_at = ?
        WHERE id = ? AND check_in_status != 'BOARDED'
        """,
        (scan_step, now, booking["id"]),
    )

    cur2 = await db.execute(
        "SELECT * FROM ticket_bookings WHERE id = ?",
        (booking["id"],),
    )
    updated = await cur2.fetchone()
    if not updated:
        return scan_response_failure("NOT_FOUND", "Δεν βρέθηκε κράτηση.")
    boarded = row_to_booking(updated)
    _notify_passenger_boarded(boarded, trip_id)
    # Push check-in to office platform (SaaS bookings + live fleet) immediately.
    try:
        from travel_platform.driver.office_boarding_notify import schedule_office_boarding_notify

        schedule_office_boarding_notify(boarded, trip_id)
    except Exception:
        pass
    return scan_response_success(boarded)


def _notify_passenger_boarded(booking: dict, trip_id: int) -> None:
    try:
        from travel_platform.growth.partner_store import dispatch_event

        dispatch_event(
            "passenger.boarded",
            {
                "booking_id": booking["id"],
                "trip_id": trip_id,
                "passenger_name": booking.get("customer_name"),
                "seat_number": booking.get("seat_number"),
                "phone": booking.get("phone"),
            },
        )
    except Exception:
        pass


async def process_scan(qr_token: str, trip_id: int) -> dict:
    token = qr_token.strip()
    if token.startswith("bt1."):
        return await _process_bt1_scan(token, trip_id)

    payload, err = verify_rotating_jwt(token)
    if err:
        return scan_response_failure(err, _msg(err))

    if int(payload["tid"]) != int(trip_id):
        return scan_response_failure(
            "TRIP_MISMATCH",
            "Το εισιτήριο δεν ανήκει σε αυτή την εκδρομή.",
        )

    ticket_ref = payload["ref"]
    step = int(payload["step"])

    async with transaction() as db:
        cur = await db.execute(
            "SELECT * FROM ticket_bookings WHERE ticket_ref = ? LIMIT 1",
            (ticket_ref,),
        )
        row = await cur.fetchone()
        if not row:
            return scan_response_failure("NOT_FOUND", "Δεν βρέθηκε κράτηση.")

        booking = row_to_booking(row)
        return await _board_booking(db, booking, trip_id=trip_id, scan_step=step)


async def _process_bt1_scan(token: str, trip_id: int) -> dict:
    payload, err = verify_bt1_token(token)
    if err:
        return scan_response_failure(err, _msg(err))

    booking_id = str(payload.get("bid", ""))
    if int(payload.get("tripId", trip_id)) != int(trip_id):
        return scan_response_failure("TRIP_MISMATCH", _msg("TRIP_MISMATCH"))

    async with transaction() as db:
        cur = await db.execute(
            "SELECT * FROM ticket_bookings WHERE id = ? OR saas_booking_id = ? LIMIT 1",
            (booking_id, booking_id),
        )
        row = await cur.fetchone()
        if not row:
            return scan_response_failure("NOT_FOUND", "Δεν βρέθηκε κράτηση.")
        return await _board_booking(db, row_to_booking(row), trip_id=trip_id, scan_step=None)


def _msg(reason: str) -> str:
    return {
        "EXPIRED": "Το QR έληξε — ζητήστε νέο από τον επιβάτη.",
        "INVALID_SIGNATURE": "Μη έγκυρη υπογραφή (πιθανή πλαστογραφία).",
        "WINDOW_MISMATCH": "Ληγμένο QR (screenshot); ανανεώστε.",
        "TRIP_MISMATCH": "Λάθος εκδρομή.",
        "NOT_FOUND": "Άγνωστο εισιτήριο.",
        "NOT_PAID": "Μη εξοφλημένη κράτηση.",
        "CANCELLED": "Ακυρωμένη κράτηση.",
        "ALREADY_SCANNED": "Ήδη επιβιβασμένος.",
        "REPLAY_DETECTED": "Επανάληψη σάρωσης.",
    }.get(reason, "Άκυρο εισιτήριο.")
