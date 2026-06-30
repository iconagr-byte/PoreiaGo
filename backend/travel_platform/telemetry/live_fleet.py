"""
Live fleet state — latest positions for admin map + heatmap aggregation.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from travel_platform.telemetry.domain import LiveVehicleState, TelemetryUpdate


class LiveFleetService:
    """In-memory latest state (sync from DB in production)."""

    _vehicles: dict[str, dict[str, Any]] = {}
    _heat_points: dict[str, list[tuple[float, float]]] = defaultdict(list)

    def upsert_vehicle_registry(
        self,
        tenant_id: UUID,
        vehicle_code: str,
        trip_id: int | None = None,
    ) -> UUID:
        key = f"{tenant_id}:{vehicle_code}"
        if key not in self._vehicles:
            vid = uuid4()
            self._vehicles[key] = {
                "vehicle_id": str(vid),
                "tenant_id": str(tenant_id),
                "vehicle_code": vehicle_code,
                "trip_id": trip_id,
            }
        else:
            if trip_id is not None:
                self._vehicles[key]["trip_id"] = trip_id
            vid = UUID(self._vehicles[key]["vehicle_id"])
        return UUID(self._vehicles[key]["vehicle_id"])

    def apply_update(
        self,
        vehicle_id: UUID,
        update: TelemetryUpdate,
        idle_seconds: int = 0,
    ) -> LiveVehicleState:
        vid = str(vehicle_id)
        state = LiveVehicleState(
            vehicle_id=vid,
            vehicle_code=update.vehicle_code,
            trip_id=update.trip_id,
            lat=update.latitude,
            lng=update.longitude,
            speed_kmh=update.speed_kmh,
            engine_on=update.engine_on,
            fuel_level_pct=update.fuel_level_pct,
            idle_seconds_trip=idle_seconds,
            updated_at=update.recorded_at,
        )
        self._vehicles[vid] = {**self._vehicles.get(vid, {}), **state.__dict__}
        raw = update.raw or {}
        if raw.get("driver_name"):
            self._vehicles[vid]["driver_name"] = raw["driver_name"]
        if raw.get("driver_id"):
            self._vehicles[vid]["driver_id"] = raw["driver_id"]
        if raw.get("bus_plate") or raw.get("vehicle_code"):
            self._vehicles[vid]["bus_plate"] = raw.get("bus_plate") or raw.get("vehicle_code")
        if raw.get("heading_deg") is not None:
            self._vehicles[vid]["heading_deg"] = raw.get("heading_deg")
        tenant = str(update.tenant_id)
        self._heat_points[tenant].append((update.latitude, update.longitude))
        if len(self._heat_points[tenant]) > 10_000:
            self._heat_points[tenant] = self._heat_points[tenant][-5000:]
        return state

    def list_active(self, tenant_id: UUID) -> list[LiveVehicleState]:
        from travel_platform.telemetry.settings_store import get_telemetry_settings

        tid = str(tenant_id)
        stale_seconds = get_telemetry_settings(tid).driver_stale_seconds
        now = datetime.now(timezone.utc)
        out = []
        for meta in self._vehicles.values():
            if meta.get("tenant_id") != tid:
                continue
            if "lat" not in meta:
                continue
            updated = meta.get("updated_at")
            if isinstance(updated, str):
                updated = datetime.fromisoformat(updated.replace("Z", "+00:00"))
            if updated and updated.tzinfo is None:
                updated = updated.replace(tzinfo=timezone.utc)
            if updated and (now - updated).total_seconds() > stale_seconds:
                continue
            out.append(
                LiveVehicleState(
                    vehicle_id=meta["vehicle_id"],
                    vehicle_code=meta.get("vehicle_code", ""),
                    trip_id=meta.get("trip_id"),
                    lat=meta["lat"],
                    lng=meta["lng"],
                    speed_kmh=meta.get("speed_kmh", 0),
                    engine_on=meta.get("engine_on", False),
                    fuel_level_pct=meta.get("fuel_level_pct"),
                    idle_seconds_trip=meta.get("idle_seconds_trip", 0),
                    updated_at=updated or datetime.now(timezone.utc),
                )
            )
        return out

    def vehicle_meta(self, tenant_id: UUID, vehicle_id: str) -> dict:
        meta = self._vehicles.get(vehicle_id, {})
        if meta.get("tenant_id") != str(tenant_id):
            return {}
        return meta

    def heatmap_grid(self, tenant_id: UUID, cell_size: float = 0.01) -> list[dict]:
        """Aggregate frequent stopping points for heatmap layer."""
        points = self._heat_points.get(str(tenant_id), [])
        grid: dict[tuple[int, int], int] = defaultdict(int)
        for lat, lng in points:
            cell = (int(lat / cell_size), int(lng / cell_size))
            grid[cell] += 1
        result = []
        for (clat, clng), weight in sorted(grid.items(), key=lambda x: -x[1])[:500]:
            if weight < 3:
                continue
            result.append(
                {
                    "lat": (clat + 0.5) * cell_size,
                    "lng": (clng + 0.5) * cell_size,
                    "weight": weight,
                }
            )
        return result
