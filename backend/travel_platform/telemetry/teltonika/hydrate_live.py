"""
Re-paint live-map pins from Teltonika device-store last fixes.

Safety / continuous fleet watch:
- Enabled IMEI with a last fix always has a pin on the admin map (last known).
- Fresh last_seen (≤ ~90s) → open «GPS οχήματος» badge.
- Stale last_seen → pin stays (parked / sparse AVL) without faking online.
- App channel is independent: offline App strips its badge; hardware pin remains.

Dual-source stability:
- Never reclaim over a *live* App pin while hardware is quiet — that caused the
  pin to jump App ↔ Teltonika last-known every few seconds.
- When hardware is online, reclaim position (App soft-acks via ingress).
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
    resolve_tracker_alive_seconds,
)

logger = logging.getLogger(__name__)

# Avoid hammering process_telemetry on every 1s live poll — still often enough
# that list_active (90s stale) never drops a safety pin.
_last_hydrate_at: dict[str, float] = {}
_MIN_INTERVAL_SEC = 2.0
# Re-stamp before list_active drops the pin (~90s driver_stale_seconds).
_REFRESH_BEFORE_STALE_SEC = 45.0


def map_presence_seconds(alive_sec: int | None = None) -> int:
    """
    Compatibility helper — hardware pins for enabled devices are kept
    continuously (no age cut-off). Callers that still pass a window get a
    large value so they never treat an enabled tracker as «expired».
    """
    alive = max(15, int(alive_sec or 90))
    return max(alive, 365 * 24 * 60 * 60)


def _app_channel_live(meta: dict[str, Any] | None, *, alive_sec: int) -> bool:
    """True when the driver App is still actively reporting on this pin."""
    meta = meta or {}
    app_age = age_seconds(meta.get("app_seen_at"))
    if app_age is not None and app_age <= alive_sec:
        return True
    if is_phone_source(meta.get("source")):
        pin_age = age_seconds(meta.get("updated_at") or meta.get("timestamp"))
        return pin_age is not None and pin_age <= alive_sec
    return False


def _pin_needs_refresh(meta: dict[str, Any] | None, *, alive_sec: int) -> bool:
    """True when there is no fresh live pin, or updated_at is aging out."""
    if not meta:
        return True
    if not is_tracker_source(meta.get("source")):
        # Non-tracker pin — caller decides whether to reclaim (device online).
        return True
    age = age_seconds(meta.get("updated_at") or meta.get("timestamp"))
    if age is None:
        return True
    if age >= _REFRESH_BEFORE_STALE_SEC:
        return True
    if not is_live_meta_tracker_fresh(meta, max_age_sec=alive_sec):
        return True
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
    Ensure a live pin for every enabled Teltonika binding with a last fix.

    Continuous safety watch: pins are not removed for age. Disabled / unbound
    devices are simply skipped (no pin paint).
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

        # Live App + quiet hardware → leave App pin alone (no jump).
        # Online hardware → reclaim position; App soft-acks for dual badge.
        if (
            existing_meta
            and not force
            and not device_online
            and _app_channel_live(existing_meta, alive_sec=alive_sec)
            and not is_tracker_source(existing_meta.get("source"))
        ):
            continue

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
