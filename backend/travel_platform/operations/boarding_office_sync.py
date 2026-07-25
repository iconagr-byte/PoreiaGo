"""Sync office (Postgres) bookings ↔ SQLite ticketing for driver check-in."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

logger = logging.getLogger(__name__)


async def sync_trip_passengers_to_ticketing(
    trip_id: int,
    *,
    tenant_id: str | None = None,
) -> dict[str, Any]:
    """
    Load travelers for this excursion from Postgres and mirror them into
    SQLite `ticket_bookings` so driver scan validates against real bookings.
    """
    try:
        trip_id = int(trip_id)
    except (TypeError, ValueError):
        return {"synced": 0, "skipped": True, "reason": "invalid_trip_id"}
    if trip_id <= 0:
        return {"synced": 0, "skipped": True, "reason": "invalid_trip_id"}

    try:
        from sqlalchemy import or_, select, text

        from app.core.database import AsyncSessionLocal
        from app.models.booking import Booking, BookingStatus, PaymentStatus
        from middleware.tenant import apply_tenant_to_session
        from ticketing.db import get_db
        from ticketing.saas_sync import upsert_ticket_booking
        from travel_platform.operations.master_qr_bridge import default_tenant_id
    except Exception as exc:
        logger.warning("boarding sync imports failed: %s", exc)
        return {"synced": 0, "error": str(exc)[:200]}

    tid = (tenant_id or "").strip() or default_tenant_id()
    synced = 0
    skipped = 0
    trip_key = str(trip_id)

    try:
        async with AsyncSessionLocal() as session:
            try:
                await apply_tenant_to_session(session, UUID(tid))
            except Exception:
                pass

            # Prefer JSONB path filter so we do not load up to 800 unrelated bookings.
            try:
                result = await session.execute(
                    select(Booking)
                    .where(
                        Booking.tenant_id == UUID(tid),
                        text(
                            "(metadata_json->>'external_trip_id' = :trip_key "
                            "OR metadata_json->>'trip_id' = :trip_key)"
                        ).bindparams(trip_key=trip_key),
                    )
                    .order_by(Booking.created_at.desc())
                    .limit(500)
                )
                bookings = list(result.scalars().all())
            except Exception:
                result = await session.execute(
                    select(Booking)
                    .where(Booking.tenant_id == UUID(tid))
                    .order_by(Booking.created_at.desc())
                    .limit(800)
                )
                bookings = []
                for b in result.scalars().all():
                    meta = dict(b.metadata_json or {})
                    ext = meta.get("external_trip_id") or meta.get("trip_id")
                    try:
                        if int(ext) == trip_id:
                            bookings.append(b)
                    except (TypeError, ValueError):
                        continue

            for b in bookings:
                meta = dict(b.metadata_json or {})
                if b.status in (BookingStatus.CANCELLED, BookingStatus.REFUNDED):
                    skipped += 1
                    continue

                paid = b.status in (
                    BookingStatus.PAID,
                    BookingStatus.CONFIRMED,
                    BookingStatus.BOARDED,
                ) or b.payment_status in (PaymentStatus.PAID, PaymentStatus.PARTIAL)
                payment_status = "PAID" if paid else "PENDING"

                seats = meta.get("seats") or []
                seat = (
                    str(b.seat_label or "").strip()
                    or (", ".join(str(s) for s in seats if s) if seats else "—")
                )
                saas_id = str(b.id)
                local_id = str(meta.get("local_id") or b.reference_code or saas_id)
                try:
                    await upsert_ticket_booking(
                        local_id=local_id,
                        trip_id=trip_id,
                        customer_name=str(b.passenger_name or "Επιβάτης"),
                        seat_number=seat or "—",
                        payment_status=payment_status,
                        phone=str(meta.get("phone") or "") or None,
                        saas_booking_id=saas_id,
                        email=str(b.passenger_email or "") or None,
                        special_requirements={
                            "pnr": b.reference_code,
                            "office_status": b.status.value if hasattr(b.status, "value") else str(b.status),
                            "saas_booking_id": saas_id,
                        },
                        commit=False,
                    )
                    if b.status == BookingStatus.BOARDED or meta.get("checked_in") or meta.get(
                        "check_in_status"
                    ) in ("CHECKED_IN", "BOARDED"):
                        await _mark_sqlite_boarded(local_id, saas_id, commit=False)
                    synced += 1
                except Exception as exc:
                    skipped += 1
                    logger.debug("passenger sync skip %s: %s", local_id, exc)

            if synced:
                try:
                    await get_db().commit()
                except Exception as exc:
                    logger.warning("passenger sync commit failed trip=%s: %s", trip_id, exc)
    except Exception as exc:
        logger.warning("sync_trip_passengers_to_ticketing failed trip=%s: %s", trip_id, exc)
        return {"synced": synced, "skipped": skipped, "error": str(exc)[:200]}

    return {"synced": synced, "skipped": skipped, "trip_id": trip_id, "tenant_id": tid}


async def _mark_sqlite_boarded(local_id: str, saas_id: str, *, commit: bool = True) -> None:
    from ticketing.db import get_db

    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    await db.execute(
        """
        UPDATE ticket_bookings
        SET check_in_status = 'BOARDED', boarded_at = COALESCE(boarded_at, ?)
        WHERE (id = ? OR saas_booking_id = ?) AND check_in_status != 'BOARDED'
        """,
        (now, local_id, saas_id or ""),
    )
    if commit:
        await db.commit()


async def mark_office_booking_boarded(
    *,
    booking: dict[str, Any],
    trip_id: int,
) -> dict[str, Any]:
    """After a successful driver check-in, flip the office Postgres booking."""
    spec = booking.get("special_requirements") or {}
    saas_id = str(
        booking.get("saas_booking_id")
        or spec.get("saas_booking_id")
        or ""
    ).strip()
    local_id = str(booking.get("id") or "").strip()
    pnr = str(spec.get("pnr") or "").strip()
    if not saas_id and not local_id and not pnr:
        return {"ok": False, "reason": "no_booking_id"}

    try:
        from sqlalchemy import or_, select

        from app.core.database import AsyncSessionLocal
        from app.models.booking import Booking, BookingStatus
        from api.admin_booking_mapper import apply_patch_to_booking
        from middleware.tenant import apply_tenant_to_session
        from travel_platform.operations.master_qr_bridge import default_tenant_id
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:200]}

    tid = default_tenant_id()
    try:
        async with AsyncSessionLocal() as session:
            try:
                await apply_tenant_to_session(session, UUID(tid))
            except Exception:
                pass

            filters = []
            if saas_id:
                try:
                    filters.append(Booking.id == UUID(saas_id))
                except ValueError:
                    pass
            for ref in (pnr, local_id):
                if ref:
                    filters.append(Booking.reference_code == ref.upper())
                    filters.append(Booking.reference_code == ref)

            booking_row = None
            if filters:
                result = await session.execute(
                    select(Booking).where(Booking.tenant_id == UUID(tid), or_(*filters)).limit(1)
                )
                booking_row = result.scalar_one_or_none()

            if booking_row is None:
                name = str(booking.get("customer_name") or "").strip()
                if name:
                    result = await session.execute(
                        select(Booking)
                        .where(Booking.tenant_id == UUID(tid), Booking.passenger_name == name)
                        .limit(20)
                    )
                    for cand in result.scalars().all():
                        meta = dict(cand.metadata_json or {})
                        try:
                            if int(meta.get("external_trip_id") or meta.get("trip_id") or 0) == int(
                                trip_id
                            ):
                                booking_row = cand
                                break
                        except (TypeError, ValueError):
                            continue

            if booking_row is None:
                return {"ok": False, "reason": "office_booking_not_found"}

            apply_patch_to_booking(
                booking_row,
                {
                    "checkedIn": True,
                    "checkInStatus": "BOARDED",
                    "status": "Ολοκληρώθηκε",
                },
            )
            if booking_row.status != BookingStatus.BOARDED:
                booking_row.status = BookingStatus.BOARDED
            await session.commit()
            return {
                "ok": True,
                "saas_booking_id": str(booking_row.id),
                "reference": booking_row.reference_code,
            }
    except Exception as exc:
        logger.warning("mark_office_booking_boarded failed: %s", exc)
        return {"ok": False, "error": str(exc)[:200]}


async def broadcast_boarding_refresh(trip_id: int) -> None:
    """Notify office/driver WS clients that the manifest changed."""
    try:
        import json

        from main import manager

        await manager.broadcast(
            json.dumps(
                {
                    "type": "boarding.refresh",
                    "trip_id": int(trip_id),
                    "at": datetime.now(timezone.utc).isoformat(),
                }
            )
        )
    except Exception:
        pass
