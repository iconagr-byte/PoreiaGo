"""
Re-paint live-map pins from Teltonika device-store last fixes.

Only *online* trackers (fresh last_seen) are hydrated onto the admin map.
Closed / parked devices stay off the map until they come online again —
same rule as the driver App channel.
"""

from __future__ import annotations

import logging
from typing import Any

from travel_platform.telemetry.teltonika.paint_live import paint_live_pin_from_device
from travel_platform.telemetry.tracker_priority import (
    age_seconds,
    is_live_meta_tracker_fresh,
    is_phone_source,
    is_tracker_binding_alive,
    is_tracker_source,
    normalize_vehicle_plate,
    resolve_tracker_alive_seconds,
)

logger = logging.getLogger(__name__)

# Avoid hammering process_telemetry on every 1s live poll — still often enough
# that list_active (90s stale) never drops an online tracker pin.
_last_hydrate_at: dict[str, float] = {}
_MIN_INTERVAL_SEC = 2.0
# Re-stamp an already-preferred pin before list_active drops it.
_REFRESH_BEFORE_STALE_SEC = 45.0


def _pin_needs_refresh(meta: dict[str, Any] | None, *, alive_sec: int) -> bool:
    """True when there is no fresh live pin, or updated_at is aging out."""
    if not meta:
        return True
    if not is_live_meta_tracker_fresh(meta, max_age_sec=alive_sec):
        return True
    age = age_seconds(meta.get("updated_at") or meta.get("timestamp"))
    if age is None:
        return True
    return age >= _REFRESH_BEFORE_STALE_SEC


def _app_channel_live(meta: dict[str, Any] | None, *, alive_sec: int) -> bool:
    meta = meta or {}
    app_age = age_seconds(meta.get("app_seen_at"))
    if app_age is not None and app_age <= alive_sec:
        return True
    if is_phone_source(meta.get("source")):
        pin_age = age_seconds(meta.get("updated_at") or meta.get("timestamp"))
        return pin_age is not None and pin_age <= alive_sec
    return False


async def hydrate_tenant_live_from_devices(tenant_id: str) -> int:
    """
    For each enabled Teltonika binding that is online, ensure a live pin exists.

    Offline trackers are removed when the App channel is also offline.
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

        device_online = is_tracker_binding_alive(device, max_age_sec=alive_sec)
        existing_vid = None
        existing_meta: dict[str, Any] = {}
        if fleet is not None:
            existing_vid = fleet.find_vehicle_id(tid, plate)
            if existing_vid:
                existing_meta = fleet._vehicles.get(existing_vid, {}) or {}  # noqa: SLF001

        if not device_online:
            # Teltonika offline — drop hardware-only pins; leave live App pins.
            if (
                fleet is not None
                and existing_vid
                and is_tracker_source(existing_meta.get("source"))
                and not _app_channel_live(existing_meta, alive_sec=alive_sec)
            ):
                try:
                    from travel_platform.telemetry.live_fleet_redis import (
                        delete_live_vehicle,
                    )

                    fleet._vehicles.pop(existing_vid, None)  # noqa: SLF001
                    plate_key = normalize_vehicle_plate(plate)
                    if plate_key:
                        fleet._code_index.pop(f"{tid}:{plate_key}", None)  # noqa: SLF001
                    await delete_live_vehicle(tid, existing_vid)
                    logger.info(
                        "teltonika offline — removed pin plate=%s tenant=%s",
                        plate,
                        tid,
                    )
                except Exception:
                    logger.debug("teltonika offline pin drop skipped", exc_info=True)
            continue

        if existing_meta and not _pin_needs_refresh(existing_meta, alive_sec=alive_sec):
            continue

        ok = await paint_live_pin_from_device(
            device,
            open_channel=True,
            reason="hydrate",
        )
        if ok:
            written += 1
    if written:
        logger.info("teltonika hydrate wrote %s live pin(s) tenant=%s", written, tid)
    return written
