"""
Re-paint live-map pins from Teltonika device-store last fixes.

When hardware updates last_seen/last_lat but the live fleet is empty
(queue lag, API restart, Redis TTL), admin maps stay blank. Hydrate
fills the gap from durable device bindings.
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

# Avoid hammering process_telemetry on every 5s poll.
_last_hydrate_at: dict[str, float] = {}
_MIN_INTERVAL_SEC = 15.0


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
    for device in list_devices(tid):
        if not device.get("enabled"):
            continue
        if device.get("last_lat") is None or device.get("last_lng") is None:
            continue
        if not is_tracker_binding_alive(device, max_age_sec=alive_sec):
            continue

        plate = str(device.get("vehicle_code") or device.get("imei") or "").strip()
        if not plate:
            continue

        # Already have a fresh Teltonika pin on the live fleet.
        prefer, _ = is_teltonika_preferred_for_plate(tid, plate, max_age_sec=alive_sec)
        if prefer:
            continue

        payload: dict[str, Any] = {
            "tenant_id": tid,
            "vehicle_code": plate,
            "latitude": float(device["last_lat"]),
            "longitude": float(device["last_lng"]),
            "speed_kmh": float(device.get("last_speed_kmh") or 0),
            "engine_status": "on",
            "heading_deg": 0.0,
            "bus_plate": plate,
            "driver_name": str(device.get("label") or f"GPS {plate}"),
            "driver_id": device.get("driver_id") or None,
            "imei": device.get("imei"),
            "source": "teltonika",
            "recorded_at": device.get("last_seen_at")
            or datetime.now(timezone.utc).isoformat(),
        }
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
