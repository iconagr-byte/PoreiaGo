"""Filter live fleet pins to drivers that belong on the office Οδηγοί list."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Only hardware tracker sources may paint a Teltonika-bound plate.
TRACKER_LIVE_SOURCES = frozenset({"teltonika", "teltonika_test_ping"})


def _meta_plate(meta: dict[str, Any]) -> str:
    return str(meta.get("vehicle_code") or meta.get("bus_plate") or "").strip().upper()


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
    if source and source not in TRACKER_LIVE_SOURCES:
        # Phone GPS (driver_pwa) must never masquerade as a tracker pin.
        return False
    try:
        from travel_platform.telemetry.teltonika.device_store import list_devices, normalize_imei
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
            return source in TRACKER_LIVE_SOURCES or not source
        plate = str(row.get("vehicle_code") or "").strip().upper()
        if code and plate and code == plate:
            return source in TRACKER_LIVE_SOURCES or not source
    return False


def office_allows_live_driver(tenant_id: str, driver_id: str | None, meta: dict[str, Any] | None = None) -> bool:
    """
    True when this pin may appear on the admin live map for ``tenant_id``.

    Seed demo drivers are never shown. Drivers must be registered on the office
    (exact tenant). Missing driver_id → hide (no orphan TRIP-1 ghosts),
    except Teltonika/tracker pins bound to this office via IMEI store.

    Phone GPS is never shown for a Teltonika-bound plate — only tracker fixes.
    """
    meta = meta or {}
    plate = _meta_plate(meta)
    if plate and office_plate_has_enabled_tracker(tenant_id, plate):
        return office_allows_tracker_pin(tenant_id, meta)

    if office_allows_tracker_pin(tenant_id, meta):
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
