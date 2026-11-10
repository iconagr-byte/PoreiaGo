"""Resolve the active excursion for a live fleet vehicle from office trip data.

GPS pins appear without an excursion. When a published trip is currently in its
departure→arrival window and matches the vehicle plate / driver, attach that
title so the live map can show a label above the bus.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

_ATHENS = ZoneInfo("Europe/Athens")
_PLATE_RE = re.compile(r"[^A-Z0-9Α-Ω]")


def normalize_plate(value: Any) -> str:
    raw = str(value or "").strip().upper().replace(" ", "")
    return _PLATE_RE.sub("", raw)


def _parse_dt(value: Any) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        dt = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if dt.tzinfo is None:
        # Office trip editor stores local Athens wall-clock without offset.
        return dt.replace(tzinfo=_ATHENS)
    return dt.astimezone(_ATHENS)


def trip_is_active_now(trip: dict[str, Any], *, now: datetime | None = None) -> bool:
    """True when published trip is inside its operating window."""
    if not isinstance(trip, dict):
        return False
    status = str(trip.get("status") or "published").strip().lower()
    if status == "draft":
        return False

    now_local = (now or datetime.now(timezone.utc)).astimezone(_ATHENS)
    dep = _parse_dt(trip.get("departureTime") or trip.get("departure_time"))
    if not dep:
        return False
    arr = _parse_dt(trip.get("arrivalTime") or trip.get("arrival_time"))

    start = dep - timedelta(hours=3)
    if arr and arr >= dep:
        end = arr + timedelta(hours=2)
    else:
        # Same calendar day in Athens, with evening grace.
        end = dep.replace(hour=23, minute=59, second=59, microsecond=0) + timedelta(hours=2)
    return start <= now_local <= end


def _plates_for_trip(trip: dict[str, Any]) -> set[str]:
    out: set[str] = set()
    for key in ("vehiclePlate", "vehicle_plate", "vehicleCode", "vehicle_code", "bus_plate"):
        plate = normalize_plate(trip.get(key))
        if plate:
            out.add(plate)
    extra = trip.get("additionalFleet") or trip.get("additional_fleet") or []
    if isinstance(extra, list):
        for row in extra:
            if not isinstance(row, dict):
                continue
            for key in ("vehiclePlate", "vehicle_plate", "vehicleCode", "vehicle_code"):
                plate = normalize_plate(row.get(key))
                if plate:
                    out.add(plate)
    return out


def _drivers_for_trip(trip: dict[str, Any]) -> set[str]:
    out: set[str] = set()
    for key in ("driverId", "driver_id"):
        did = str(trip.get(key) or "").strip()
        if did:
            out.add(did)
    extra = trip.get("additionalFleet") or trip.get("additional_fleet") or []
    if isinstance(extra, list):
        for row in extra:
            if not isinstance(row, dict):
                continue
            did = str(row.get("driverId") or row.get("driver_id") or "").strip()
            if did:
                out.add(did)
    return out


def _trip_matches(
    trip: dict[str, Any],
    *,
    plate: str,
    driver_id: str,
) -> bool:
    if plate and plate in _plates_for_trip(trip):
        return True
    if driver_id and driver_id in _drivers_for_trip(trip):
        return True
    return False


def resolve_active_excursion(
    tenant_id: str | None,
    *,
    vehicle_code: str | None = None,
    bus_plate: str | None = None,
    driver_id: str | None = None,
    now: datetime | None = None,
) -> dict[str, Any] | None:
    """
    Return ``{trip_id, title}`` for the best matching active excursion, or None.

    Matching uses office trip catalog fields (vehiclePlate / driverId / fleet rows)
    and the departure→arrival window.
    """
    tid = str(tenant_id or "").strip()
    plate = normalize_plate(bus_plate or vehicle_code)
    did = str(driver_id or "").strip()
    if not tid or (not plate and not did):
        return None

    try:
        from travel_platform.operations.tenant_trip_catalog_store import list_tenant_trips

        trips = list_tenant_trips(tid, published_only=True)
    except Exception:
        logger.debug("active excursion catalog read failed", exc_info=True)
        return None

    candidates: list[tuple[datetime, dict[str, Any]]] = []
    for trip in trips or []:
        if not _trip_matches(trip, plate=plate, driver_id=did):
            continue
        if not trip_is_active_now(trip, now=now):
            continue
        dep = _parse_dt(trip.get("departureTime") or trip.get("departure_time")) or datetime.min.replace(
            tzinfo=_ATHENS
        )
        candidates.append((dep, trip))

    if not candidates:
        return None

    # Prefer the trip whose departure is closest to now (latest start still active).
    candidates.sort(key=lambda row: row[0], reverse=True)
    best = candidates[0][1]
    try:
        trip_id = int(best.get("id"))
    except (TypeError, ValueError):
        return None
    title = str(best.get("title") or "").strip() or f"Εκδρομή #{trip_id}"
    return {"trip_id": trip_id, "title": title}


def enrich_meta_with_active_excursion(
    tenant_id: str | None,
    meta: dict[str, Any] | None,
    *,
    vehicle_code: str | None = None,
    trip_id: int | None = None,
) -> tuple[int | None, str | None, dict[str, Any]]:
    """
    Ensure meta carries trip_id/title when an active excursion matches.

    Returns ``(trip_id, trip_title, meta)``.
    """
    meta = dict(meta or {})
    current_trip = trip_id if trip_id is not None else meta.get("trip_id")
    try:
        current_trip_i = int(current_trip) if current_trip not in (None, "") else None
    except (TypeError, ValueError):
        current_trip_i = None

    title = str(meta.get("trip_title") or "").strip() or None
    if current_trip_i and title:
        return current_trip_i, title, meta

    if current_trip_i and not title:
        from travel_platform.telemetry.trip_title_resolve import resolve_trip_title_sync

        title = resolve_trip_title_sync(current_trip_i) or None
        if title:
            meta["trip_title"] = title
        return current_trip_i, title, meta

    hit = resolve_active_excursion(
        tenant_id,
        vehicle_code=vehicle_code or meta.get("vehicle_code"),
        bus_plate=meta.get("bus_plate"),
        driver_id=meta.get("driver_id"),
    )
    if not hit:
        return None, title, meta

    meta["trip_id"] = hit["trip_id"]
    meta["trip_title"] = hit["title"]
    return int(hit["trip_id"]), str(hit["title"]), meta
