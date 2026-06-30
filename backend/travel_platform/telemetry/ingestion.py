"""Fast ingestion path — validate and enqueue only (202 Accepted)."""

from __future__ import annotations

from uuid import UUID

from travel_platform.telemetry.queue import enqueue_telemetry


class TelemetryIngestionService:
    async def accept_update(
        self,
        *,
        tenant_id: UUID,
        vehicle_code: str,
        latitude: float,
        longitude: float,
        speed_kmh: float,
        engine_status: str,
        fuel_level_pct: float | None = None,
        trip_id: int | None = None,
        driver_id: UUID | None = None,
        recorded_at: str | None = None,
        heading_deg: float | None = None,
        accel_x: float | None = None,
        accel_y: float | None = None,
        accel_z: float | None = None,
        tracker_event_id: int | None = None,
    ) -> str:
        payload = {
            "tenant_id": str(tenant_id),
            "vehicle_code": vehicle_code,
            "latitude": latitude,
            "longitude": longitude,
            "speed_kmh": speed_kmh,
            "engine_status": engine_status,
            "fuel_level_pct": fuel_level_pct,
            "trip_id": trip_id,
            "driver_id": str(driver_id) if driver_id else None,
            "recorded_at": recorded_at,
            "heading_deg": heading_deg,
            "accel_x": accel_x,
            "accel_y": accel_y,
            "accel_z": accel_z,
            "tracker_event_id": tracker_event_id,
        }
        return await enqueue_telemetry(payload)
