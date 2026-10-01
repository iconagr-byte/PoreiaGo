"""Filter live fleet pins to drivers that belong on the office Οδηγοί list."""

from __future__ import annotations

import logging
from typing import Any

from travel_platform.telemetry.tracker_priority import TRACKER_LIVE_SOURCES, is_tracker_source

logger = logging.getLogger(__name__)


def _meta_plate(meta: dict[str, Any]) -> str:
    from travel_platform.telemetry.tracker_priority import normalize_vehicle_plate

    return normalize_vehicle_plate(meta.get("vehicle_code") or meta.get("bus_plate"))


def office_plate_has_enabled_tracker(tenant_id: str, vehicle_code: str | None) -> bool:
    """True when this office plate has an enabled Teltonika IMEI binding."""
    try:
        from travel_platform.telemetry.teltonika.device_store import (
            get_enabled_device_by_vehicle_code,
        )
    except Exception:
        return False
    return get_enabled_device_by_vehicle_code(str(tenant_id), vehicle_code) is not None


def office_allows_tracker_pin(tenant_id: str, meta: dict[str, Any] | None) -> bool:
    """True when pin is a Teltonika/tracker fix for a vehicle bound to this office."""
    meta = meta or {}
    source = str(meta.get("source") or "").strip().lower()
    # Empty source allowed for legacy tracker rows; phone sources must use driver path.
    if source and not is_tracker_source(source) and source not in TRACKER_LIVE_SOURCES:
        return False
    try:
        from travel_platform.telemetry.teltonika.device_store import list_devices, normalize_imei
        from travel_platform.telemetry.tracker_priority import normalize_vehicle_plate
    except Exception:
        return False

    code = _meta_plate(meta)
    imei = normalize_imei(meta.get("imei"))
    if not code and not imei:
        return False

    for row in list_devices(str(tenant_id)):
        if not row.get("enabled"):
            continue
        if imei and normalize_imei(row.get("imei")) == imei:
            return True
        plate = normalize_vehicle_plate(row.get("vehicle_code"))
        if code and plate and code == plate:
            return True
    return False


def office_allows_live_driver(tenant_id: str, driver_id: str | None, meta: dict[str, Any] | None = None) -> bool:
    """
    True when this pin may appear on the admin live map for ``tenant_id``.

    Seed demo drivers are never shown. Drivers must be registered on the office
    (exact tenant). Missing driver_id → hide (no orphan TRIP-1 ghosts),
    except Teltonika/tracker pins bound to this office via IMEI store.

    Phone GPS on a Teltonika-bound plate is allowed only as soft fallback
    (written by ingress when the tracker is stale) via the normal driver path.
    """
    meta = meta or {}
    if is_tracker_source(meta.get("source")) and office_allows_tracker_pin(tenant_id, meta):
        return True
    # Legacy tracker rows without source still allowed when bound.
    if not meta.get("source") and office_allows_tracker_pin(tenant_id, meta):
        return True

    did = str(driver_id or meta.get("driver_id") or "").strip()
    if not did:
        return False
    try:
        from travel_platform.settings.drivers_store import (
            DEMO_TENANT_ID,
            get_driver,
            is_seed_driver,
            office_driver_id_set,
        )

        if is_seed_driver(get_driver(did)):
            return False
        allowed = office_driver_id_set(str(tenant_id), include_demo_legacy=False)
        if allowed:
            return did in allowed
        # Empty office list → never show foreign/DEMO pins.
        bound = get_driver(did)
        if not bound:
            return False
        home = str(getattr(bound, "tenant_id", None) or DEMO_TENANT_ID)
        return home == str(tenant_id) and home != str(DEMO_TENANT_ID)
    except Exception:
        logger.debug("office_allows_live_driver failed", exc_info=True)
        return False
