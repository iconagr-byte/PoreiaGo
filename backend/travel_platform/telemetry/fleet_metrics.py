"""Prometheus metrics — fleet telemetry pipeline."""

from __future__ import annotations

import os
from typing import Any
from uuid import UUID

from prometheus_client import Counter, Gauge

_ENABLED: bool | None = None


class _NoopMetric:
    def labels(self, *args: Any, **kwargs: Any) -> _NoopMetric:
        return self

    def inc(self, amount: float = 1) -> None:
        return None

    def set(self, value: float) -> None:
        return None


def metrics_enabled() -> bool:
    global _ENABLED
    if _ENABLED is None:
        _ENABLED = os.getenv("METRICS_ENABLED", "true").lower() not in ("0", "false", "no")
    return _ENABLED


def _gauge(name: str, documentation: str, labelnames: tuple[str, ...] = ()) -> Gauge | _NoopMetric:
    if not metrics_enabled():
        return _NoopMetric()
    return Gauge(name, documentation, labelnames)


def _counter(name: str, documentation: str, labelnames: tuple[str, ...] = ()) -> Counter | _NoopMetric:
    if not metrics_enabled():
        return _NoopMetric()
    return Counter(name, documentation, labelnames)


FLEET_GPS_INGRESS_TOTAL = _counter(
    "fleet_gps_ingress_total",
    "Driver PWA GPS points ingested",
    ("tenant_id",),
)

FLEET_ACTIVE_VEHICLES = _gauge(
    "fleet_active_vehicles",
    "Vehicles with recent GPS on live fleet map",
    ("tenant_id",),
)

FLEET_ACTIVE_DRIVERS = _gauge(
    "fleet_active_drivers",
    "Distinct drivers with recent GPS",
    ("tenant_id",),
)

FLEET_COORDINATE_BUFFER_POINTS = _gauge(
    "fleet_coordinate_buffer_points",
    "GPS points waiting in memory buffer before PostGIS flush",
)

FLEET_DRIVER_WS_CONNECTIONS = _gauge(
    "fleet_driver_ws_connections",
    "Active driver telemetry WebSocket connections",
)

FLEET_ADMIN_WS_CONNECTIONS = _gauge(
    "fleet_admin_ws_connections",
    "Active admin fleet map WebSocket connections",
)

FLEET_ALERTS_TOTAL = _counter(
    "fleet_alerts_total",
    "Telemetry alerts emitted (route deviation, driving events, shift)",
    ("alert_type", "tenant_id"),
)

FLEET_STALE_OFFLINE_TOTAL = _counter(
    "fleet_stale_offline_total",
    "Drivers marked offline due to stale GPS timeout",
    ("tenant_id",),
)

FLEET_GPS_RETENTION_DELETED_TOTAL = _counter(
    "fleet_gps_retention_deleted_total",
    "Historical GPS points deleted by retention policy",
    ("tenant_id",),
)

FLEET_GPS_RATE_LIMITED_TOTAL = _counter(
    "fleet_gps_rate_limited_total",
    "Driver GPS ingress points rejected by rate limiter",
    ("tenant_id",),
)

FLEET_WEBHOOK_DISPATCHED_TOTAL = _counter(
    "fleet_webhook_dispatched_total",
    "fleet.location partner webhooks queued for delivery",
    ("tenant_id",),
)

# Track last tenant set for gauge cleanup on scrape
_last_tenant_gauges: set[str] = set()


def record_gps_ingress(tenant_id: str) -> None:
    FLEET_GPS_INGRESS_TOTAL.labels(tenant_id=tenant_id or "unknown").inc()


def record_fleet_alert(*, alert_type: str, tenant_id: str) -> None:
    FLEET_ALERTS_TOTAL.labels(
        alert_type=alert_type or "UNKNOWN",
        tenant_id=tenant_id or "unknown",
    ).inc()


def record_stale_offline(tenant_id: str) -> None:
    FLEET_STALE_OFFLINE_TOTAL.labels(tenant_id=tenant_id or "unknown").inc()


def record_gps_retention_purge(*, tenant_id: str, deleted: int) -> None:
    if deleted <= 0:
        return
    FLEET_GPS_RETENTION_DELETED_TOTAL.labels(tenant_id=tenant_id or "unknown").inc(deleted)


def record_gps_rate_limited(tenant_id: str) -> None:
    FLEET_GPS_RATE_LIMITED_TOTAL.labels(tenant_id=tenant_id or "unknown").inc()


def record_fleet_webhook_dispatched(tenant_id: str) -> None:
    FLEET_WEBHOOK_DISPATCHED_TOTAL.labels(tenant_id=tenant_id or "unknown").inc()


def refresh_fleet_gauges() -> None:
    """Update gauges from in-memory fleet state (called on Prometheus scrape)."""
    if not metrics_enabled():
        return

    from travel_platform.telemetry.coordinate_buffer import pending_count
    from travel_platform.telemetry.driver_shift_tracker import active_connection_count
    from travel_platform.telemetry.fleet_ws_hub import get_fleet_egress_hub
    from travel_platform.telemetry.processor import get_live_fleet

    live = get_live_fleet()
    tenant_vehicles: dict[str, int] = {}
    tenant_drivers: dict[str, set[str]] = {}

    for meta in live._vehicles.values():
        if "lat" not in meta:
            continue
        tid = str(meta.get("tenant_id") or "unknown")
        tenant_vehicles[tid] = tenant_vehicles.get(tid, 0) + 1
        driver_id = meta.get("driver_id")
        if driver_id:
            tenant_drivers.setdefault(tid, set()).add(str(driver_id))

    global _last_tenant_gauges
    current_tenants = set(tenant_vehicles) | set(tenant_drivers)
    for tid in _last_tenant_gauges - current_tenants:
        FLEET_ACTIVE_VEHICLES.labels(tenant_id=tid).set(0)
        FLEET_ACTIVE_DRIVERS.labels(tenant_id=tid).set(0)
    _last_tenant_gauges = current_tenants

    for tid, count in tenant_vehicles.items():
        FLEET_ACTIVE_VEHICLES.labels(tenant_id=tid).set(count)
    for tid, drivers in tenant_drivers.items():
        FLEET_ACTIVE_DRIVERS.labels(tenant_id=tid).set(len(drivers))

    FLEET_COORDINATE_BUFFER_POINTS.set(float(pending_count()))
    FLEET_DRIVER_WS_CONNECTIONS.set(float(active_connection_count()))
    FLEET_ADMIN_WS_CONNECTIONS.set(float(get_fleet_egress_hub().connection_count()))


def snapshot_fleet_metrics(tenant_id: UUID | str) -> dict[str, Any]:
    """JSON summary for admin/debug (optional)."""
    from travel_platform.telemetry.coordinate_buffer import pending_count
    from travel_platform.telemetry.driver_shift_tracker import active_connection_count
    from travel_platform.telemetry.fleet_ws_hub import get_fleet_egress_hub
    from travel_platform.telemetry.processor import get_live_fleet

    tid = str(tenant_id)
    live = get_live_fleet()
    try:
        tenant_uuid = UUID(tid)
    except ValueError:
        tenant_uuid = tenant_id  # type: ignore[assignment]
    vehicles = live.list_active(tenant_uuid)  # type: ignore[arg-type]
    return {
        "tenant_id": tid,
        "active_vehicles": len(vehicles),
        "coordinate_buffer_points": pending_count(),
        "driver_ws_connections": active_connection_count(),
        "admin_ws_connections": get_fleet_egress_hub().connection_count(),
        "metrics_enabled": metrics_enabled(),
    }
