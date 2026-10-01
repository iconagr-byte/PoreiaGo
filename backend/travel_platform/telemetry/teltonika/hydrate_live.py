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
from typing import Any

from travel_platform.telemetry.teltonika.paint_live import paint_live_pin_from_device
from travel_platform.telemetry.tracker_priority import (
    age_seconds,
    is_live_meta_tracker_fresh,
    is_tracker_binding_alive,
    resolve_tracker_alive_seconds,
)

logger = logging.getLogger(__name__)

# Avoid hammering process_telemetry on every 1s live poll — still often enough
# that list_active (90s stale) never drops an online tracker pin.
_last_hydrate_at: dict[str, float] = {}
_MIN_INTERVAL_SEC = 2.0
# Parked buses may send AVL rarely — keep last known hardware pin longer
# when the map is otherwise empty.
_HYDRATE_MAX_AGE_SEC = 6 * 60 * 60
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
        existing_meta: dict[str, Any] = {}
        if fleet is not None:
            existing_vid = fleet.find_vehicle_id(tid, plate)
            if existing_vid:
                existing_meta = fleet._vehicles.get(existing_vid, {}) or {}  # noqa: SLF001

        if existing_meta:
            # Pin already on map — refresh online trackers; leave parked App alone.
            if not device_online:
                continue
            if not _pin_needs_refresh(existing_meta, alive_sec=alive_sec):
                continue
        else:
            # Empty map — online always; parked within long hydrate window.
            if device_online:
                pass
            elif not is_tracker_binding_alive(device, max_age_sec=_HYDRATE_MAX_AGE_SEC):
                continue

        ok = await paint_live_pin_from_device(
            device,
            open_channel=device_online,
            reason="hydrate",
        )
        if ok:
            written += 1
    if written:
        logger.info("teltonika hydrate wrote %s live pin(s) tenant=%s", written, tid)
    return written
