"""
Re-paint live-map pins from Teltonika device-store last fixes.

When hardware updates last_seen/last_lat but the live fleet is empty
(queue lag, API restart, Redis TTL), admin maps stay blank. Hydrate
fills the gap from durable device bindings.

Online trackers (fresh last_seen) also reclaim the map pin over App GPS
so an open Teltonika always appears on the admin map.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from travel_platform.telemetry.tracker_priority import (
    is_teltonika_preferred_for_plate,
    is_tracker_binding_alive,
    resolve_tracker_alive_seconds,
)

logger = logging.getLogger(__name__)

# Avoid hammering process_telemetry on every live poll.
_last_hydrate_at: dict[str, float] = {}
_MIN_INTERVAL_SEC = 8.0
# Parked buses may send AVL rarely — keep last known hardware pin longer
# when the map is otherwise empty.
_HYDRATE_MAX_AGE_SEC = 6 * 60 * 60


async def hydrate_tenant_live_from_devices(tenant_id: str) -> int:
    """
    For each enabled Teltonika binding with a recent fix, ensure a live pin exists.

    Returns number of pins (re)written.
    """
    tid = str(tenant_id or "").strip()
    if not tid:
        return 0

    import time

    now_m = time.monotonic()
    last = _last_hydrate_at.get(tid, 0.0)
    if now_m - last < _MIN_INTERVAL_SEC:
        return 0
    _last_hydrate_at[tid] = now_m

    try:
        from travel_platform.telemetry.processor import process_telemetry_payload
        from travel_platform.telemetry.teltonika.device_store import list_devices
    except Exception:
        logger.debug("teltonika hydrate imports failed", exc_info=True)
        return 0

    alive_sec = resolve_tracker_alive_seconds(tid)
    written = 0
    try:
        from travel_platform.telemetry.processor import get_live_fleet

        fleet = get_live_fleet()
    except Exception:
        fleet = None

    for device in list_devices(tid):
        if not device.get("enabled"):
            continue
        if device.get("last_lat") is None or device.get("last_lng") is None:
            continue

        plate = str(device.get("vehicle_code") or device.get("imei") or "").strip()
        if not plate:
            continue

        # Already have a fresh Teltonika pin on the live fleet.
        prefer, _ = is_teltonika_preferred_for_plate(tid, plate, max_age_sec=alive_sec)
        if prefer:
            continue

        device_online = is_tracker_binding_alive(device, max_age_sec=alive_sec)
        existing_vid = None
        if fleet is not None:
            existing_vid = fleet.find_vehicle_id(tid, plate)
            existing_meta = fleet._vehicles.get(existing_vid or "", {}) if existing_vid else {}  # noqa: SLF001
        else:
            existing_meta = {}

        if existing_vid and existing_meta:
            # Pin already on map — only take over when the tracker is truly open.
            if not device_online:
                continue
        else:
            # Empty map — allow longer parked hydrate window.
            if not is_tracker_binding_alive(device, max_age_sec=_HYDRATE_MAX_AGE_SEC):
                continue

        recorded = datetime.now(timezone.utc).isoformat()
        signal_at = str(device.get("last_seen_at") or recorded)
        # Online TCP session → open channel. Parked store-only → parked hydrate.
        payload: dict[str, Any] = {
            "tenant_id": tid,
            "vehicle_code": plate,
            "latitude": float(device["last_lat"]),
            "longitude": float(device["last_lng"]),
            "speed_kmh": float(device.get("last_speed_kmh") or 0),
            "engine_status": "on" if device_online else "off",
            "heading_deg": 0.0,
            "bus_plate": plate,
            "driver_name": str(device.get("label") or f"GPS {plate}"),
            "driver_id": device.get("driver_id") or None,
            "imei": device.get("imei"),
            "source": "teltonika",
            "recorded_at": recorded,
            "tracker_signal_at": signal_at if device_online else signal_at,
            "hydrated_from_store": not device_online,
        }
        if device_online:
            # Open tracker: treat last_seen as a live signal for badges/soft-ack.
            payload["tracker_signal_at"] = signal_at
            payload["hydrated_from_store"] = False
        try:
            await process_telemetry_payload(payload)
            written += 1
        except Exception:
            logger.warning(
                "teltonika hydrate failed tenant=%s plate=%s",
                tid,
                plate,
                exc_info=True,
            )
    if written:
        logger.info("teltonika hydrate wrote %s live pin(s) tenant=%s", written, tid)
    return written
