"""Best-effort Postgres dual-write for rental JSON store entities."""

from __future__ import annotations

import logging
import threading
from decimal import Decimal
from typing import Any
from uuid import UUID

logger = logging.getLogger(__name__)


def _as_uuid(value: Any) -> UUID | None:
    try:
        return UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        return None


def _parse_dt(value: Any):
    if value is None:
        return None
    from datetime import datetime, timezone

    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    raw = str(value).strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _fire(fn, *args, **kwargs) -> None:
    def runner() -> None:
        try:
            fn(*args, **kwargs)
        except Exception:
            logger.exception("rental pg sync failed in %s", getattr(fn, "__name__", fn))

    try:
        threading.Thread(target=runner, daemon=True).start()
    except Exception:
        logger.debug("rental pg sync thread spawn failed", exc_info=True)


def _run_async(coro_factory) -> None:
    import asyncio

    try:
        asyncio.run(coro_factory())
    except Exception:
        logger.exception("rental pg async sync failed")


async def _upsert_vehicle_async(vehicle: dict[str, Any]) -> None:
    from app.core.database import AsyncSessionLocal
    from app.models.fleet_rental import RentalVehicle

    vid = _as_uuid(vehicle.get("id"))
    tid = _as_uuid(vehicle.get("tenant_id"))
    if not vid or not tid:
        return
    async with AsyncSessionLocal() as session:
        existing = await session.get(RentalVehicle, vid)
        if existing is None:
            row = RentalVehicle(
                id=vid,
                tenant_id=tid,
                plate_number=str(vehicle.get("plate_number") or "")[:32],
                category=str(vehicle.get("category") or "CAR")[:32],
                model=str(vehicle.get("model") or "")[:120],
                seating_capacity=int(vehicle.get("seating_capacity") or 5),
                current_status=str(vehicle.get("current_status") or "AVAILABLE")[:32],
                current_mileage=int(vehicle.get("current_mileage") or 0),
                daily_rate_eur=Decimal(str(vehicle.get("daily_rate_eur") or 0)),
                one_way_surcharge_eur=Decimal(str(vehicle.get("one_way_surcharge_eur") or 0)),
                with_driver_daily_eur=Decimal(str(vehicle.get("with_driver_daily_eur") or 0)),
                gps_device_id=(str(vehicle.get("gps_device_id") or "").strip() or None),
                photo_url=vehicle.get("photo_url"),
                photo_urls=list(vehicle.get("photo_urls") or []),
                description=vehicle.get("description"),
                notes=vehicle.get("notes"),
            )
            session.add(row)
        else:
            existing.plate_number = str(vehicle.get("plate_number") or existing.plate_number)[:32]
            existing.category = str(vehicle.get("category") or existing.category)[:32]
            existing.model = str(vehicle.get("model") or existing.model)[:120]
            existing.seating_capacity = int(vehicle.get("seating_capacity") or existing.seating_capacity)
            existing.current_status = str(vehicle.get("current_status") or existing.current_status)[:32]
            existing.current_mileage = int(vehicle.get("current_mileage") or existing.current_mileage or 0)
            existing.daily_rate_eur = Decimal(str(vehicle.get("daily_rate_eur") or 0))
            existing.one_way_surcharge_eur = Decimal(str(vehicle.get("one_way_surcharge_eur") or 0))
            existing.with_driver_daily_eur = Decimal(str(vehicle.get("with_driver_daily_eur") or 0))
            existing.gps_device_id = str(vehicle.get("gps_device_id") or "").strip() or None
            existing.photo_url = vehicle.get("photo_url")
            existing.photo_urls = list(vehicle.get("photo_urls") or [])
            existing.description = vehicle.get("description")
            existing.notes = vehicle.get("notes")
        await session.commit()


async def _upsert_booking_async(booking: dict[str, Any]) -> None:
    from app.core.database import AsyncSessionLocal
    from app.models.fleet_rental import RentalBooking

    bid = _as_uuid(booking.get("id"))
    tid = _as_uuid(booking.get("tenant_id"))
    vid = _as_uuid(booking.get("vehicle_id"))
    if not bid or not tid or not vid:
        return
    start = _parse_dt(booking.get("start_time"))
    end = _parse_dt(booking.get("end_time"))
    if not start or not end:
        return
    client_id = _as_uuid(booking.get("client_id"))
    async with AsyncSessionLocal() as session:
        existing = await session.get(RentalBooking, bid)
        if existing is None:
            session.add(
                RentalBooking(
                    id=bid,
                    tenant_id=tid,
                    vehicle_id=vid,
                    client_id=client_id,
                    client_name=str(booking.get("client_name") or "—")[:160],
                    client_email=(str(booking.get("client_email") or "").strip().lower() or None),
                    client_phone=(str(booking.get("client_phone") or "").strip() or None),
                    start_time=start,
                    end_time=end,
                    pickup_location=str(booking.get("pickup_location") or "")[:240],
                    dropoff_location=str(booking.get("dropoff_location") or booking.get("pickup_location") or "")[
                        :240
                    ],
                    total_cost=Decimal(str(booking.get("total_cost") or 0)),
                    rental_status=str(booking.get("rental_status") or "CONFIRMED")[:32],
                    driver_mode=str(booking.get("driver_mode") or "SELF_DRIVE")[:32],
                    assigned_driver_id=(str(booking.get("assigned_driver_id") or "").strip() or None),
                    notes=booking.get("notes"),
                )
            )
        else:
            existing.vehicle_id = vid
            existing.client_id = client_id
            existing.client_name = str(booking.get("client_name") or existing.client_name)[:160]
            existing.client_email = str(booking.get("client_email") or "").strip().lower() or None
            existing.client_phone = str(booking.get("client_phone") or "").strip() or None
            existing.start_time = start
            existing.end_time = end
            existing.pickup_location = str(booking.get("pickup_location") or "")[:240]
            existing.dropoff_location = str(
                booking.get("dropoff_location") or booking.get("pickup_location") or ""
            )[:240]
            existing.total_cost = Decimal(str(booking.get("total_cost") or 0))
            existing.rental_status = str(booking.get("rental_status") or existing.rental_status)[:32]
            existing.driver_mode = str(booking.get("driver_mode") or existing.driver_mode)[:32]
            existing.assigned_driver_id = str(booking.get("assigned_driver_id") or "").strip() or None
            existing.notes = booking.get("notes")
        await session.commit()


async def _upsert_inspection_async(inspection: dict[str, Any]) -> None:
    from app.core.database import AsyncSessionLocal
    from app.models.fleet_rental import VehicleInspection
    from decimal import Decimal

    iid = _as_uuid(inspection.get("id"))
    tid = _as_uuid(inspection.get("tenant_id"))
    bid = _as_uuid(inspection.get("rental_booking_id"))
    if not iid or not tid or not bid:
        return
    async with AsyncSessionLocal() as session:
        existing = await session.get(VehicleInspection, iid)
        if existing is None:
            session.add(
                VehicleInspection(
                    id=iid,
                    tenant_id=tid,
                    rental_booking_id=bid,
                    inspection_type=str(inspection.get("inspection_type") or "PICKUP_CHECK")[:32],
                    fuel_level=Decimal(str(inspection.get("fuel_level") or 100)),
                    mileage=int(inspection.get("mileage") or 0),
                    damage_notes=inspection.get("damage_notes"),
                    photo_urls=list(inspection.get("photo_urls") or []),
                    signature_url=inspection.get("signature_url"),
                    inspector_name=inspection.get("inspector_name"),
                )
            )
        else:
            existing.inspection_type = str(inspection.get("inspection_type") or existing.inspection_type)[:32]
            existing.fuel_level = Decimal(str(inspection.get("fuel_level") or 100))
            existing.mileage = int(inspection.get("mileage") or 0)
            existing.damage_notes = inspection.get("damage_notes")
            existing.photo_urls = list(inspection.get("photo_urls") or [])
            existing.signature_url = inspection.get("signature_url")
            existing.inspector_name = inspection.get("inspector_name")
        await session.commit()


def sync_vehicle_to_pg(vehicle: dict[str, Any]) -> None:
    """Best-effort upsert of a rental vehicle. Invalid UUID → skip."""
    if not vehicle or not _as_uuid(vehicle.get("id")) or not _as_uuid(vehicle.get("tenant_id")):
        return
    _fire(_run_async, lambda: _upsert_vehicle_async(vehicle))


def sync_booking_to_pg(booking: dict[str, Any]) -> None:
    """Best-effort upsert of a rental booking. Invalid UUID ids → skip."""
    if (
        not booking
        or not _as_uuid(booking.get("id"))
        or not _as_uuid(booking.get("tenant_id"))
        or not _as_uuid(booking.get("vehicle_id"))
    ):
        return
    _fire(_run_async, lambda: _upsert_booking_async(booking))


def sync_inspection_to_pg(inspection: dict[str, Any]) -> None:
    if (
        not inspection
        or not _as_uuid(inspection.get("id"))
        or not _as_uuid(inspection.get("tenant_id"))
        or not _as_uuid(inspection.get("rental_booking_id"))
    ):
        return
    _fire(_run_async, lambda: _upsert_inspection_async(inspection))
