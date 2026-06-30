"""Telemetry alert bus — admin dashboard + persistence hooks."""

from __future__ import annotations

from collections import deque
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from travel_platform.telemetry.domain import DrivingBehaviorEvent, RouteDeviationAlert


class TelemetryAlertBus:
    _recent: deque[dict[str, Any]] = deque(maxlen=500)

    @classmethod
    def push_driver_shift(
        cls,
        *,
        alert_type: str,
        tenant_id: str,
        message: str,
        metadata: dict[str, Any],
    ) -> dict[str, Any]:
        row = {
            "id": str(uuid4()),
            "alert_type": alert_type,
            "tenant_id": str(tenant_id),
            "vehicle_id": metadata.get("bus_plate"),
            "trip_id": metadata.get("trip_id"),
            "message": message,
            "metadata": metadata,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        cls._recent.appendleft(row)
        cls._notify_ws(row)
        return row

    @classmethod
    def push_route_deviation(cls, alert: RouteDeviationAlert) -> dict[str, Any]:
        row = {
            "id": str(uuid4()),
            "alert_type": "ROUTE_DEVIATION",
            "tenant_id": str(alert.tenant_id),
            "vehicle_id": str(alert.vehicle_id),
            "trip_id": alert.trip_id,
            "message": alert.message,
            "metadata": {
                "lat": alert.lat,
                "lng": alert.lng,
                "distance_outside_m": alert.distance_outside_m,
                "buffer_m": alert.buffer_m,
            },
            "created_at": alert.detected_at.isoformat(),
        }
        cls._recent.appendleft(row)
        cls._notify_ws(row)
        return row

    @classmethod
    def push_driving_event(
        cls,
        *,
        tenant_id: str,
        vehicle_id: str,
        trip_id: int | None,
        event: DrivingBehaviorEvent,
    ) -> dict[str, Any]:
        row = {
            "id": str(uuid4()),
            "alert_type": event.event_type,
            "tenant_id": tenant_id,
            "vehicle_id": vehicle_id,
            "trip_id": trip_id,
            "message": f"Οδηγική συμπεριφορά: {event.event_type}",
            "metadata": {
                "event_type": event.event_type,
                "tracker_event_id": event.tracker_event_id,
                "peak_g": event.peak_g,
                "score_delta": event.score_delta,
                "recorded_at": event.recorded_at.isoformat(),
                "lat": event.lat,
                "lng": event.lng,
                "speed_kmh": event.speed_kmh,
            },
            "created_at": event.recorded_at.isoformat(),
        }
        cls._recent.appendleft(row)
        cls._notify_ws(row)
        return row

    @classmethod
    def ingest_redis_alert(cls, row: dict[str, Any]) -> dict[str, Any] | None:
        """Idempotent ingest from Redis fleet_alerts (multi-instance fan-in)."""
        alert_id = str(row.get("id") or "")
        if alert_id and any(a.get("id") == alert_id for a in cls._recent):
            return None
        if not row.get("created_at"):
            row = {**row, "created_at": datetime.now(timezone.utc).isoformat()}
        cls._recent.appendleft(row)
        cls._notify_ws(row)
        return row

    @classmethod
    def _notify_ws(cls, row: dict[str, Any]) -> None:
        try:
            from travel_platform.telemetry.fleet_metrics import record_fleet_alert

            record_fleet_alert(
                alert_type=str(row.get("alert_type") or "UNKNOWN"),
                tenant_id=str(row.get("tenant_id") or "unknown"),
            )
        except Exception:
            pass
        try:
            import asyncio
            from travel_platform.telemetry.ws_hub import push_telemetry_alert

            loop = asyncio.get_running_loop()
            loop.create_task(push_telemetry_alert(row))
        except RuntimeError:
            pass

    @classmethod
    def list_recent(cls, tenant_id: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        items = list(cls._recent)
        if tenant_id:
            items = [a for a in items if a.get("tenant_id") == tenant_id]
        return items[:limit]
