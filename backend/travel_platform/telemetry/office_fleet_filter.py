"""Filter live fleet pins to drivers that belong on the office Οδηγοί list."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def office_allows_live_driver(tenant_id: str, driver_id: str | None, meta: dict[str, Any] | None = None) -> bool:
    """
    True when this pin may appear on the admin live map for ``tenant_id``.

    Seed demo drivers are never shown. Drivers must be registered on the office
    (exact tenant). Missing driver_id → hide (no orphan TRIP-1 ghosts).
    """
    did = str(driver_id or (meta or {}).get("driver_id") or "").strip()
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
