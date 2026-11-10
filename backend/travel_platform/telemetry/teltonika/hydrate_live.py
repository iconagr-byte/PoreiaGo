"""
Re-paint live-map pins from Teltonika device-store last fixes.

Live map policy:
- Online IMEI (fresh last_seen ≤ ~90s) → open «GPS οχήματος» pin.
- Offline IMEI → pin is removed (no last-known ghost after power cut).
- Live App GPS is independent: quiet hardware must not yank a live App pin.

Dual-source stability:
- Never reclaim over a *live* App pin while hardware is quiet.
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
# that list_active (90s stale) never drops an online pin.
_last_hydrate_at: dict[str, float] = {}
_MIN_INTERVAL_SEC = 2.0
# Re-stamp before list_active drops the pin (~90s driver_stale_seconds).
_REFRESH_BEFORE_STALE_SEC = 45.0


def map_presence_seconds(alive_sec: int | None = None) -> int:
    """
    How long an offline hardware pin may linger — aligned with alive window.
    (Previously 365 days for continuous safety watch; that left ghosts after unplug.)
    """
    return max(15, int(alive_sec or 90))


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


async def _drop_offline_hardware_pin(
    fleet: Any,
    *,
    tenant_id: str,
    plate: str,
    meta: dict[str, Any],
) -> bool:
    """Remove a Teltonika-only / hydrated pin when the IMEI is offline."""
    if not fleet or not meta:
        return False
    # Live App channel keeps the pin (hardware badge drops via resolve).
    if _app_channel_live(meta, alive_sec=resolve_tracker_alive_seconds(tenant_id)):
        return False
    src = str(meta.get("source") or "").strip().lower()
    is_hw = is_tracker_source(src) or bool(meta.get("hydrated_from_store")) or bool(meta.get("imei"))
    if not is_hw and is_phone_source(src):
        return False

    vid = str(meta.get("vehicle_id") or fleet.find_vehicle_id(tenant_id, plate) or "").strip()
    if not vid:
        return False

    try:
        from travel_platform.telemetry.live_fleet_redis import delete_live_vehicle
    except Exception:
        delete_live_vehicle = None  # type: ignore

    fleet._vehicles.pop(vid, None)  # noqa: SLF001
    for idx_key, idx_vid in list(getattr(fleet, "_code_index", {}).items()):
        if idx_vid == vid:
            fleet._code_index.pop(idx_key, None)  # noqa: SLF001
    if delete_live_vehicle is not None:
        try:
            await delete_live_vehicle(tenant_id, vid)
        except Exception:
            logger.debug(
                "teltonika offline pin redis delete failed plate=%s",
                plate,
                exc_info=True,
            )
    logger.info(
        "teltonika offline pin removed plate=%s tenant=%s vehicle=%s",
        plate,
        tenant_id,
        vid,
    )
    return True


async def hydrate_tenant_live_from_devices(
    tenant_id: str,
    *,
    force: bool = False,
) -> int:
    """
    Paint live pins for online Teltonika bindings; drop offline hardware pins.

    Offline IMEIs no longer leave a last-known ghost on the admin map.
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
    dropped = 0
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

        # Offline hardware → remove ghost pin (unless App is still live).
        if not device_online:
            if (
                existing_meta
                and not force
                and _app_channel_live(existing_meta, alive_sec=alive_sec)
                and not is_tracker_source(existing_meta.get("source"))
            ):
                continue
            if existing_meta and await _drop_offline_hardware_pin(
                fleet, tenant_id=tid, plate=plate, meta=existing_meta
            ):
                dropped += 1
            continue

        # Live App + quiet hardware was handled above (offline branch).
        # Online hardware → reclaim / refresh.
        if (
            existing_meta
            and not force
            and not _pin_needs_refresh(existing_meta, alive_sec=alive_sec)
            and is_live_meta_tracker_fresh(existing_meta, max_age_sec=alive_sec)
        ):
            continue

        # Reclaim App-only pin → move to hardware coords. Refreshing an existing
        # Teltonika pin must not re-stamp store lat/lng (pin jump / GPS noise).
        reclaim_from_app = bool(
            existing_meta
            and (
                is_phone_source(existing_meta.get("source"))
                or not is_tracker_source(existing_meta.get("source"))
            )
        )
        ok = await paint_live_pin_from_device(
            device,
            open_channel=True,
            reason="hydrate_force" if force else "hydrate",
            move_coords=reclaim_from_app or not existing_meta,
        )
        if ok:
            written += 1
    if written or dropped:
        logger.info(
            "teltonika hydrate tenant=%s wrote=%s dropped_offline=%s",
            tid,
            written,
            dropped,
        )
    return written
