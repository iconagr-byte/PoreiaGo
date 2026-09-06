"""Trip seat occupancy — prevent double-booking of the same seat."""
from __future__ import annotations

from typing import Any, Iterable
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, BookingStatus

INACTIVE_STATUSES = frozenset({BookingStatus.CANCELLED, BookingStatus.REFUNDED})


def normalize_seat_code(raw: Any) -> str:
    return "".join(str(raw or "").split()).upper()


def seats_from_booking(booking: Booking) -> set[str]:
    out: set[str] = set()
    meta = booking.metadata_json or {}
    seats = meta.get("seats") or []
    if isinstance(seats, list):
        for s in seats:
            code = normalize_seat_code(s)
            if code:
                out.add(code)
    if booking.seat_label:
        for part in str(booking.seat_label).split(","):
            code = normalize_seat_code(part)
            if code:
                out.add(code)
    return out


def booking_matches_external_trip(booking: Booking, external_trip_id: int | None) -> bool:
    if external_trip_id is None:
        return False
    meta = booking.metadata_json or {}
    raw = meta.get("external_trip_id", meta.get("trip_id"))
    if raw is None:
        return False
    try:
        return int(raw) == int(external_trip_id)
    except (TypeError, ValueError):
        return False


async def load_occupied_seats_for_trip(
    db: AsyncSession,
    *,
    tenant_id: UUID,
    external_trip_id: int,
    for_update: bool = False,
) -> set[str]:
    """Active (non-cancelled) seat codes for an excursion trip."""
    stmt = select(Booking).where(
        Booking.tenant_id == tenant_id,
        Booking.status.notin_(tuple(INACTIVE_STATUSES)),
    )
    if for_update:
        stmt = stmt.with_for_update()
    result = await db.execute(stmt)
    taken: set[str] = set()
    for booking in result.scalars().all():
        if not booking_matches_external_trip(booking, external_trip_id):
            continue
        taken |= seats_from_booking(booking)
    return taken


def conflicting_seats(requested: Iterable[str], occupied: set[str]) -> list[str]:
    wanted = {normalize_seat_code(s) for s in (requested or []) if normalize_seat_code(s)}
    return sorted(wanted & occupied)
