"""SOS & incident reporting — Redis fleet_alerts + admin WebSocket."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from travel_platform.telemetry.alerts import TelemetryAlertBus
from travel_platform.telemetry.fleet_pubsub import publish_fleet_alert


async def publish_driver_sos(
    *,
    tenant_id: str,
    trip_id: int,
    driver_id: str | None,
    lat: float,
    lng: float,
    accuracy_m: float | None = None,
    message: str | None = None,
    incident_type: str = "sos",
    photo_path: str | None = None,
    driver_token: str | None = None,
) -> dict[str, Any]:
    alert_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "id": alert_id,
        "alert_type": "SOS" if incident_type == "sos" else incident_type.upper(),
        "severity": "critical",
        "tenant_id": str(tenant_id),
        "trip_id": trip_id,
        "driver_id": driver_id,
        "lat": lat,
        "lng": lng,
        "accuracy_m": accuracy_m,
        "message": message or "Εκτάκτως SOS από οδηγό",
        "photo_path": photo_path,
        "created_at": now,
        "driver_token_hash": _hash_token(driver_token),
    }

    published_redis = await publish_fleet_alert(payload)

    TelemetryAlertBus.push_driver_shift(
        alert_type="SOS",
        tenant_id=str(tenant_id),
        message=payload["message"],
        metadata={
            "trip_id": trip_id,
            "driver_id": driver_id,
            "lat": lat,
            "lng": lng,
            "accuracy_m": accuracy_m,
            "alert_id": alert_id,
            "photo_path": photo_path,
            "incident_type": incident_type,
        },
    )

    return {
        "ok": True,
        "alert_id": alert_id,
        "message": "Κεντρικό γραφείο ειδοποιήθηκε",
        "published_redis": published_redis,
    }


def _hash_token(token: str | None) -> str | None:
    if not token:
        return None
    return hashlib.sha256(token.encode("utf-8")).hexdigest()[:16]
