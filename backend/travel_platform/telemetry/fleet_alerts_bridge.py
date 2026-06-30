"""Redis fleet_alerts → TelemetryAlertBus + admin WebSocket bridge."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)

_bridge_task: asyncio.Task | None = None


def _normalize_redis_alert(payload: dict[str, Any]) -> dict[str, Any]:
    meta = {
        k: v
        for k, v in payload.items()
        if k
        not in {
            "id",
            "alert_type",
            "tenant_id",
            "trip_id",
            "driver_id",
            "message",
            "created_at",
            "severity",
        }
    }
    return {
        "id": str(payload.get("id", "")),
        "alert_type": str(payload.get("alert_type") or "SOS"),
        "tenant_id": str(payload.get("tenant_id") or ""),
        "vehicle_id": payload.get("vehicle_id") or payload.get("driver_id"),
        "trip_id": payload.get("trip_id"),
        "message": payload.get("message") or "Fleet alert",
        "metadata": meta,
        "created_at": payload.get("created_at"),
        "severity": payload.get("severity") or (
            "critical" if str(payload.get("alert_type", "")).upper() == "SOS" else "warning"
        ),
    }


async def _bridge_loop() -> None:
    from travel_platform.telemetry.alerts import TelemetryAlertBus
    from travel_platform.telemetry.fleet_pubsub import subscribe_fleet_alerts

    try:
        async for payload in subscribe_fleet_alerts():
            row = _normalize_redis_alert(payload)
            if not row["id"]:
                continue
            TelemetryAlertBus.ingest_redis_alert(row)
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("fleet_alerts Redis bridge stopped")


def start_fleet_alerts_bridge() -> None:
    """Start once at app startup — forwards Redis SOS to admin WS clients."""
    global _bridge_task
    if _bridge_task is not None and not _bridge_task.done():
        return
    _bridge_task = asyncio.create_task(_bridge_loop())
    logger.info("fleet_alerts Redis bridge started")
