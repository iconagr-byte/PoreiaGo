"""Outbound partner webhooks — fleet.location events (ERP / BI)."""

from __future__ import annotations

import logging
import threading
import time
from typing import Any

logger = logging.getLogger(__name__)

FLEET_LOCATION_EVENT = "fleet.location"

_lock = threading.Lock()
_last_dispatch_monotonic: dict[str, float] = {}


def build_fleet_location_webhook_payload(egress: dict[str, Any]) -> dict[str, Any]:
    """Normalize fleet egress message for partner webhook consumers."""
    return {
        "tenant_id": str(egress.get("tenant_id") or ""),
        "trip_id": egress.get("trip_id"),
        "driver_id": egress.get("driver_id"),
        "driver_name": egress.get("driver_name"),
        "vehicle_id": egress.get("vehicle_id"),
        "vehicle_code": egress.get("vehicle_code"),
        "bus_plate": egress.get("bus_plate"),
        "lat": egress.get("lat"),
        "lng": egress.get("lng"),
        "speed_kmh": egress.get("speed"),
        "heading_deg": egress.get("heading"),
        "recorded_at": egress.get("timestamp"),
        "source": "driver_pwa",
    }


def _webhook_throttle_key(egress: dict[str, Any]) -> str:
    tenant_id = str(egress.get("tenant_id") or "unknown")
    driver_id = str(egress.get("driver_id") or "driver")
    trip_id = str(egress.get("trip_id") or "")
    return f"{tenant_id}:{driver_id}:{trip_id}"


def should_dispatch_fleet_webhook(
    egress: dict[str, Any],
    *,
    min_interval_sec: int,
) -> bool:
    """Rate-limit outbound webhooks per driver/trip."""
    if min_interval_sec <= 0:
        return True
    key = _webhook_throttle_key(egress)
    now = time.monotonic()
    with _lock:
        last = _last_dispatch_monotonic.get(key, 0.0)
        if now - last < float(min_interval_sec):
            return False
        _last_dispatch_monotonic[key] = now
        return True


def reset_fleet_webhook_throttle() -> None:
    with _lock:
        _last_dispatch_monotonic.clear()


def dispatch_fleet_location_webhook(tenant_id: str, egress: dict[str, Any]) -> dict[str, Any]:
    """Queue fleet.location webhook if enabled and not throttled."""
    from travel_platform.telemetry.settings_store import get_telemetry_settings

    settings = get_telemetry_settings(str(tenant_id))
    if not settings.fleet_webhook_enabled:
        return {"skipped": True, "reason": "disabled"}

    if not should_dispatch_fleet_webhook(egress, min_interval_sec=settings.fleet_webhook_min_interval_sec):
        return {"skipped": True, "reason": "throttled"}

    payload = build_fleet_location_webhook_payload(egress)
    try:
        from app.services.payment_dispatch import dispatch_partner_webhook

        dispatch_partner_webhook(tenant_id, FLEET_LOCATION_EVENT, payload)
        try:
            from travel_platform.telemetry.fleet_metrics import record_fleet_webhook_dispatched

            record_fleet_webhook_dispatched(str(tenant_id))
        except Exception:
            pass
        return {"queued": True, "event": FLEET_LOCATION_EVENT}
    except Exception as exc:
        logger.warning("Fleet location webhook dispatch failed tenant=%s: %s", tenant_id, exc)
        return {"error": str(exc)}


def maybe_dispatch_fleet_location_webhook(tenant_id: str, egress: dict[str, Any]) -> None:
    """Fire-and-forget helper from hot GPS ingress path."""
    try:
        dispatch_fleet_location_webhook(tenant_id, egress)
    except Exception:
        logger.debug("Fleet webhook dispatch skipped", exc_info=True)
