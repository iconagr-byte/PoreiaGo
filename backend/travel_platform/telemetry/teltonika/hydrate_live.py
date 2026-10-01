"""
Re-paint live-map pins from Teltonika device-store last fixes.

- Online (fresh last_seen ≤ ~90s): open channel + badge «GPS οχήματος».
- Recent last-known (≤ map presence, default 15 min): keep pin on the map
  even when AVL is sparse (parked bus at 0 km/h) — without faking «online».
- Older than map presence + no live App: remove pin from the map.
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
# Last-known hardware pin stays on the map this long after last_seen
# (badge «online» still uses the shorter alive window ~90s).
_MAP_PRESENCE_SEC = 15 * 60


def map_presence_seconds(alive_sec: int | None = None) -> int:
    """How long a Teltonika last-fix stays visible on the admin map."""
    alive = max(15, int(alive_sec or 90))
    return max(alive, _MAP_PRESENCE_SEC)


def _pin_needs_refresh(meta: dict[str, Any] | None, *, alive_sec: int) -> bool:
    """True when there is no fresh live pin, or updated_at is aging out."""
    if not meta:
        return True
    if not is_tracker_source(meta.get("source")):
        # App-only pin — online Teltonika must reclaim the plate.
        return True
    age = age_seconds(meta.get("updated_at") or meta.get("timestamp"))
    if age is None:
        return True
    # Keep list_active (driver_stale_seconds ≈ 90s) from dropping the pin.
    if age >= _REFRESH_BEFORE_STALE_SEC:
        return True
    # Online channel must stay stamped fresh for the dual badge.
    if not is_live_meta_tracker_fresh(meta, max_age_sec=alive_sec):
        return True
    return False


def _app_channel_live(meta: dict[str, Any] | None, *, alive_sec: int) -> bool:
    meta = meta or {}
    app_age = age_seconds(meta.get("app_seen_at"))
    if app_age is not None and app_age <= alive_sec:
        return True
    if is_phone_source(meta.get("source")):
        pin_age = age_seconds(meta.get("updated_at") or meta.get("timestamp"))
        return pin_age is not None and pin_age <= alive_sec
    return False


def clear_hydrate_throttle(tenant_id: str | None = None) -> None:
    """Allow the next hydrate to run immediately (empty-map recovery)."""
    tid = str(tenant_id or "").strip()
    if tid:
        _last_hydrate_at.pop(tid, None)
    else:
        _last_hydrate_at.clear()


async def hydrate_tenant_live_from_devices(
    tenant_id: str,
    *,
    force: bool = False,
) -> int:
    """
    Ensure live pins for enabled Teltonika bindings with a recent last fix.

    Online devices get an open channel. Devices inside the map-presence window
    keep a last-known pin (parked / sparse AVL). Past presence → remove when
    App is also offline.
    """
    tid = str(tenant_id or "").strip()
    if not tid:
        return 0

    import time

    now_m = time.monotonic()
    last = _last_hydrate_at.get(tid, 0.0)
    if not force and now_m - last < _MIN_INTERVAL_SEC:
        return 0
    _last_hydrate_at[tid] = now_m

    try:
        from travel_platform.telemetry.teltonika.device_store import list_devices
    except Exception:
        logger.debug("teltonika hydrate imports failed", exc_info=True)
        return 0

    alive_sec = resolve_tracker_alive_seconds(tid)
    presence_sec = map_presence_seconds(alive_sec)
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
        on_map_window = is_tracker_binding_alive(device, max_age_sec=presence_sec)
        existing_vid = None
        existing_meta: dict[str, Any] = {}
        if fleet is not None:
            existing_vid = fleet.find_vehicle_id(tid, plate)
            if existing_vid:
                existing_meta = fleet._vehicles.get(existing_vid, {}) or {}  # noqa: SLF001

        if not on_map_window:
            # Past map presence — drop hardware-only pins; leave live App.
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
                        "teltonika past map presence — removed pin plate=%s tenant=%s",
                        plate,
                        tid,
                    )
                except Exception:
                    logger.debug("teltonika offline pin drop skipped", exc_info=True)
            continue

        # Inside presence window — keep / refresh pin (open only when online).
        if existing_meta and not force and not _pin_needs_refresh(
            existing_meta, alive_sec=alive_sec
        ):
            continue

        ok = await paint_live_pin_from_device(
            device,
            open_channel=device_online,
            reason="hydrate_force" if force else "hydrate",
        )
        if ok:
            written += 1
    if written:
        logger.info("teltonika hydrate wrote %s live pin(s) tenant=%s", written, tid)
    return written
