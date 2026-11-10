"""Enrich live fleet rows with driver photo + bus image for the admin map."""

from __future__ import annotations

from typing import Any


DEFAULT_BUS_IMAGE = "/images/hero-bus-achillio.png"


def _normalize_plate(value: str | None) -> str:
    return (value or "").strip().upper().replace(" ", "")


def enrich_live_vehicle_media(
    *,
    driver_id: str | None,
    bus_plate: str | None = None,
    vehicle_code: str | None = None,
) -> dict[str, Any]:
    """Return photo_url + vehicle_image_url for a live vehicle row."""
    photo_url: str | None = None
    vehicle_image_url = DEFAULT_BUS_IMAGE
    resolved_plate = bus_plate or vehicle_code

    try:
        from travel_platform.settings.drivers_store import get_driver

        driver = get_driver(driver_id) if driver_id else None
        if driver:
            photo_url = getattr(driver, "photo_url", None) or None
            resolved_plate = (
                getattr(driver, "license_plate", None)
                or getattr(driver, "vehicle_code", None)
                or resolved_plate
            )
    except Exception:
        driver = None

    try:
        from travel_platform.fleet.service_service import service_service

        needle = _normalize_plate(resolved_plate) or _normalize_plate(vehicle_code)
        if needle:
            for v in service_service.list_vehicles():
                plate = _normalize_plate(v.get("plate_number") or v.get("code"))
                if plate == needle:
                    vehicle_image_url = v.get("public_image_url") or vehicle_image_url
                    resolved_plate = v.get("plate_number") or resolved_plate
                    break
    except Exception:
        pass

    if not vehicle_image_url:
        vehicle_image_url = DEFAULT_BUS_IMAGE

    return {
        "photo_url": photo_url,
        "vehicle_image_url": vehicle_image_url,
        "bus_plate": resolved_plate or bus_plate or vehicle_code,
    }
