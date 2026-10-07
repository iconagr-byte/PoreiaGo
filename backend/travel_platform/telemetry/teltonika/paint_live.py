"""
Force a Teltonika live-map pin from a device-store binding.

Used when TCP accepts an IMEI (device online) but AVL GPS has not arrived yet,
and by hydrate when the live fleet is empty after restart / Redis TTL.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from travel_platform.telemetry.processor import process_telemetry_payload

logger = logging.getLogger(__name__)


async def paint_live_pin_from_device(
    device: dict[str, Any] | None,
    *,
    open_channel: bool = True,
    reason: str = "paint",
    move_coords: bool = True,
) -> bool:
    """
    Write / refresh a live fleet pin from durable last_lat/last_lng.

    When ``move_coords=False`` and a pin already exists, keep its lat/lng and
    only refresh the open-channel / signal metadata — stops keepalive/hydrate
    from yanking the pin between App GPS and last-store fixes.

    Returns True when a pin was written.
    """
    device = device or {}
    if device.get("last_lat") is None or device.get("last_lng") is None:
        return False
    tid = str(device.get("tenant_id") or "").strip()
    plate = str(device.get("vehicle_code") or device.get("imei") or "").strip()
    if not tid or not plate:
        return False

    # After «Τέλος βάρδιας», hydrate/keepalive must not resurrect the pin.
    # Real IMEI accept / AVL clears suppress first.
    if reason in {"hydrate", "hydrate_force", "tcp_keepalive", "ingress_device_online"}:
        try:
            from travel_platform.telemetry.teltonika.shift_suppress import (
                is_shift_suppressed,
            )

            if is_shift_suppressed(tid, plate):
                return False
        except Exception:
            pass

    lat = float(device["last_lat"])
    lng = float(device["last_lng"])
    speed = float(device.get("last_speed_kmh") or 0)
    if not move_coords:
        try:
            from travel_platform.telemetry.processor import get_live_fleet

            fleet = get_live_fleet()
            vid = fleet.find_vehicle_id(tid, plate) if fleet else None
            meta = (fleet._vehicles.get(vid) or {}) if vid and fleet else {}  # noqa: SLF001
            if meta.get("lat") is not None and meta.get("lng") is not None:
                lat = float(meta["lat"])
                lng = float(meta["lng"])
                if meta.get("speed_kmh") is not None:
                    speed = float(meta.get("speed_kmh") or 0)
        except Exception:
            logger.debug(
                "teltonika paint keep-coords lookup skipped plate=%s",
                plate,
                exc_info=True,
            )

    recorded = datetime.now(timezone.utc).isoformat()
    signal_at = str(device.get("last_seen_at") or recorded)
    # Server receive time keeps list_active from dropping the pin as stale.
    payload: dict[str, Any] = {
        "tenant_id": tid,
        "vehicle_code": plate,
        "latitude": lat,
        "longitude": lng,
        "speed_kmh": speed,
        "engine_status": "on" if open_channel else "off",
        "heading_deg": 0.0,
        "bus_plate": plate,
        "driver_name": str(device.get("label") or f"GPS {plate}"),
        "driver_id": device.get("driver_id") or None,
        "imei": device.get("imei"),
        "source": "teltonika",
        "recorded_at": recorded,
        "tracker_signal_at": recorded if open_channel else signal_at,
        "hydrated_from_store": not open_channel,
    }
    try:
        await process_telemetry_payload(payload)
        logger.info(
            "teltonika live pin %s plate=%s imei=%s tenant=%s open=%s move=%s",
            reason,
            plate,
            device.get("imei"),
            tid,
            open_channel,
            move_coords,
        )
        return True
    except Exception:
        logger.warning(
            "teltonika live pin failed reason=%s plate=%s",
            reason,
            plate,
            exc_info=True,
        )
        return False
