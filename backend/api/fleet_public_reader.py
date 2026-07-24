"""Read public fleet showcase — real store only, never demo seed."""

from __future__ import annotations

from typing import Any


def read_public_fleet(tenant_id: str | None = None) -> list[dict[str, Any]]:
    """
    Vehicles marked show_on_website for the given office.
    Empty list when the office has no fleet — no demo fallback.
    """
    from travel_platform.fleet.service_service import ServiceService

    return ServiceService().list_public_vehicles(tenant_id=tenant_id)
