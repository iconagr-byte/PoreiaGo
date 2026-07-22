"""Notify office platform immediately when a passenger boards on the bus."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

logger = logging.getLogger(__name__)


def schedule_office_boarding_notify(booking: dict[str, Any], trip_id: int) -> None:
    """Fire-and-forget after a successful SQLite board — never blocks the scan path."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    loop.create_task(_safe_notify(booking, trip_id))


async def _safe_notify(booking: dict[str, Any], trip_id: int) -> None:
    try:
        await notify_office_after_boarding(booking, trip_id)
    except Exception:
        logger.exception(
            "Office boarding notify failed booking=%s trip=%s",
            booking.get("id"),
            trip_id,
        )


def _compact_boarding(manifest: dict[str, Any]) -> dict[str, Any]:
    passengers = manifest.get("boarded_passengers") or []
    compact = []
    for p in passengers[:50]:
        if not isinstance(p, dict):
            continue
        compact.append(
            {
                "booking_id": p.get("booking_id"),
                "passenger_name": p.get("passenger_name") or p.get("customer_name"),
                "seat_number": p.get("seat_number") or p.get("seat"),
                "boarded_at": p.get("boarded_at"),
            },
        )
    return {
        "boarded_count": manifest.get("boarded_count", len(compact)),
        "capacity": manifest.get("capacity"),
        "progress_label": manifest.get("progress_label"),
        "progress_percent": manifest.get("progress_percent"),
        "boarded_passengers": compact,
    }


async def mark_saas_booking_boarded(booking: dict[str, Any]) -> str | None:
    """Mark Postgres SaaS booking as boarded so BackOffice Κρατήσεις updates."""
    from sqlalchemy import select

    from app.core.database import AsyncSessionLocal
    from app.models.booking import Booking, BookingStatus

    candidates: list[UUID] = []
    for raw in (booking.get("saas_booking_id"), booking.get("id")):
        if not raw:
            continue
        try:
            candidates.append(UUID(str(raw)))
        except (TypeError, ValueError, AttributeError):
            continue

    ticket_ref = str(booking.get("ticket_ref") or "").strip()
    boarded_at = booking.get("boarded_at") or datetime.now(timezone.utc).isoformat()

    async with AsyncSessionLocal() as db:
        row = None
        if candidates:
            result = await db.execute(select(Booking).where(Booking.id.in_(candidates)).limit(1))
            row = result.scalar_one_or_none()
        if row is None and ticket_ref:
            result = await db.execute(
                select(Booking).where(Booking.reference_code == ticket_ref).limit(1),
            )
            row = result.scalar_one_or_none()
        if row is None and ticket_ref.startswith("B-"):
            result = await db.execute(
                select(Booking).where(Booking.reference_code == ticket_ref[2:]).limit(1),
            )
            row = result.scalar_one_or_none()
        if row is None:
            return None

        meta = dict(row.metadata_json or {})
        meta["checked_in"] = True
        meta["check_in_status"] = "BOARDED"
        meta["boarded_at"] = boarded_at
        row.metadata_json = meta
        if row.status not in (BookingStatus.CANCELLED, BookingStatus.REFUNDED):
            row.status = BookingStatus.BOARDED
        await db.commit()
        return str(row.tenant_id)


async def _attach_boarding_to_live_vehicles(
    tenant_id: str,
    trip_id: int,
    boarding: dict[str, Any],
) -> list[str]:
    from travel_platform.telemetry.live_fleet_redis import save_live_vehicle
    from travel_platform.telemetry.processor import get_live_fleet

    live = get_live_fleet()
    touched: list[str] = []
    for vid, meta in list(live._vehicles.items()):
        if str(meta.get("trip_id") or "") != str(trip_id):
            continue
        # Prefer matching tenant; still update legacy demo-keyed rows for the same trip.
        tid = str(meta.get("tenant_id") or "")
        if tid and tid != str(tenant_id) and tenant_id:
            # Keep updating if only one live bus shares this trip_id.
            pass
        updated = {**meta, "boarding": boarding}
        live._vehicles[vid] = updated
        try:
            await save_live_vehicle(updated)
        except Exception:
            logger.debug("boarding Redis save skipped", exc_info=True)
        touched.append(vid)
    return touched


async def notify_office_after_boarding(booking: dict[str, Any], trip_id: int) -> dict[str, Any]:
    """Sync SaaS + push boarding snapshot to live fleet / office WS."""
    from travel_platform.operations.master_qr_bridge import resolve_platform_tenant_id
    from travel_platform.telemetry.fleet_pubsub import publish_fleet_location
    from travel_platform.telemetry.fleet_ws_hub import get_fleet_egress_hub
    from ticketing.boarding_service import get_boarding_manifest

    tenant_id = await mark_saas_booking_boarded(booking)
    if not tenant_id:
        try:
            tenant_id = await resolve_platform_tenant_id()
        except Exception:
            tenant_id = ""

    manifest = await get_boarding_manifest(int(trip_id))
    boarding = _compact_boarding(manifest)

    vehicle_ids: list[str] = []
    if tenant_id:
        vehicle_ids = await _attach_boarding_to_live_vehicles(str(tenant_id), int(trip_id), boarding)

    egress = {
        "type": "boarding_update",
        "tenant_id": str(tenant_id or ""),
        "trip_id": int(trip_id),
        "booking_id": booking.get("id"),
        "saas_booking_id": booking.get("saas_booking_id"),
        "passenger_name": booking.get("customer_name"),
        "seat_number": booking.get("seat_number"),
        "boarded_at": booking.get("boarded_at"),
        "boarding": boarding,
        "vehicle_ids": vehicle_ids,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if tenant_id:
        await publish_fleet_location(str(tenant_id), egress)
        await get_fleet_egress_hub().broadcast(str(tenant_id), egress)

    try:
        from travel_platform.driver.boarding_ws_hub import broadcast_boarding_update

        await broadcast_boarding_update(int(trip_id), egress)
    except Exception:
        logger.debug("boarding WS broadcast skipped", exc_info=True)

    return {"ok": True, "tenant_id": tenant_id, "boarding": boarding, "vehicle_ids": vehicle_ids}
