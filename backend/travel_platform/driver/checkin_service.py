"""E-Manifest passenger check-in — trip-scoped boarding."""

from __future__ import annotations

import time

from ticketing.scan_service import (
    get_booking_by_id,
    get_booking_by_ref,
    process_scan,
    scan_response_failure,
)
from ticketing.db import transaction, row_to_booking


async def driver_checkin(
    *,
    trip_id: int,
    ticket_id: str | None = None,
    qr_raw: str | None = None,
) -> dict:
    """
    Validate ticket against active trip and mark passenger BOARDED.
    Accepts QR token (camera) or explicit ticket_id / booking ref.
    """
    start = time.perf_counter()

    raw_qr = (qr_raw or "").strip()
    tid = (ticket_id or "").strip()

    if raw_qr:
        result = await process_scan(raw_qr, trip_id)
    elif tid:
        result = await _checkin_by_ticket_id(tid, trip_id)
    else:
        result = scan_response_failure("MISSING_INPUT", "Απαιτείται ticket_id ή qr_raw.")

    elapsed_ms = (time.perf_counter() - start) * 1000
    result["elapsed_ms"] = round(elapsed_ms, 2)
    result["ok"] = result.get("result") == "SUCCESS"
    return result


async def _checkin_by_ticket_id(ticket_id: str, trip_id: int) -> dict:
    from ticketing.scan_service import _board_booking

    booking = await get_booking_by_id(ticket_id)
    if not booking:
        booking = await get_booking_by_ref(ticket_id)
    if not booking:
        return scan_response_failure("NOT_FOUND", "Δεν βρέθηκε εισιτήριο.")

    async with transaction() as db:
        cur = await db.execute(
            "SELECT * FROM ticket_bookings WHERE id = ? LIMIT 1",
            (booking["id"],),
        )
        row = await cur.fetchone()
        if not row:
            return scan_response_failure("NOT_FOUND", "Δεν βρέθηκε εισιτήριο.")
        return await _board_booking(db, row_to_booking(row), trip_id=trip_id, scan_step=None)
