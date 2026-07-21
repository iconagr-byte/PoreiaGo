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
    """In-memory latest state (sync from DB in production).

    Vehicles are keyed by UUID. A secondary index maps `{tenant}:{vehicle_code}` → UUID
    so registry + GPS updates stay on the same record (required for list_active / snapshots).
    """

    _vehicles: dict[str, dict[str, Any]] = {}
    _code_index: dict[str, str] = {}
    _heat_points: dict[str, list[tuple[float, float]]] = defaultdict(list)

    def upsert_vehicle_registry(
        self,
        tenant_id: UUID,
        vehicle_code: str,
        trip_id: int | None = None,
    ) -> UUID:
        code = (vehicle_code or "UNKNOWN").strip() or "UNKNOWN"
        key = f"{tenant_id}:{code}"
        existing = self._code_index.get(key)
        if existing and existing in self._vehicles:
            meta = self._vehicles[existing]
            meta["tenant_id"] = str(tenant_id)
            meta["vehicle_code"] = code
            if trip_id is not None:
                meta["trip_id"] = trip_id
            return UUID(existing)

        vid = str(uuid4())
        self._code_index[key] = vid
        self._vehicles[vid] = {
            "vehicle_id": vid,
            "tenant_id": str(tenant_id),
            "vehicle_code": code,
            "trip_id": trip_id,
            "bus_plate": code,
        }
        return UUID(vid)

    def apply_update(
        self,
        vehicle_id: UUID,
        update: TelemetryUpdate,
        idle_seconds: int = 0,
    ) -> LiveVehicleState:
        vid = str(vehicle_id)
        prev = self._vehicles.get(vid, {})
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
        merged = {
            **prev,
            **state.__dict__,
            "vehicle_id": vid,
            "tenant_id": str(update.tenant_id),
            "vehicle_code": update.vehicle_code,
        }
        raw = update.raw or {}
        if raw.get("driver_name"):
            merged["driver_name"] = raw["driver_name"]
        if raw.get("driver_id"):
            merged["driver_id"] = raw["driver_id"]
        plate = raw.get("bus_plate") or raw.get("vehicle_code") or update.vehicle_code
        if plate:
            merged["bus_plate"] = plate
        if raw.get("heading_deg") is not None:
            merged["heading_deg"] = raw.get("heading_deg")

        self._vehicles[vid] = merged
        # Keep code index in sync
        code_key = f"{update.tenant_id}:{update.vehicle_code}"
        self._code_index[code_key] = vid

        tenant = str(update.tenant_id)
        self._heat_points[tenant].append((update.latitude, update.longitude))
        if len(self._heat_points[tenant]) > 10_000:
            self._heat_points[tenant] = self._heat_points[tenant][-5000:]
        return state

    def find_vehicle_id(self, tenant_id: str, vehicle_code: str) -> str | None:
        key = f"{tenant_id}:{vehicle_code}"
        vid = self._code_index.get(key)
        if vid and vid in self._vehicles:
            return vid
        for candidate, meta in self._vehicles.items():
            if meta.get("tenant_id") == tenant_id and meta.get("vehicle_code") == vehicle_code:
                return candidate
        return None

    def _meta_to_state(self, meta: dict[str, Any], *, stale_seconds: int, now: datetime) -> LiveVehicleState | None:
        if meta.get("lat") is None or meta.get("lng") is None:
            return None
        from travel_platform.telemetry.live_fleet_redis import parse_updated_at

        updated = parse_updated_at(meta.get("updated_at"))
        if updated and (now - updated).total_seconds() > stale_seconds:
            return None
        return LiveVehicleState(
            vehicle_id=str(meta.get("vehicle_id") or ""),
            vehicle_code=meta.get("vehicle_code", ""),
            trip_id=meta.get("trip_id"),
            lat=float(meta["lat"]),
            lng=float(meta["lng"]),
            speed_kmh=float(meta.get("speed_kmh") or 0),
            engine_on=bool(meta.get("engine_on", False)),
            fuel_level_pct=meta.get("fuel_level_pct"),
            idle_seconds_trip=int(meta.get("idle_seconds_trip") or 0),
            updated_at=updated or now,
        )

    def list_active(self, tenant_id: UUID) -> list[LiveVehicleState]:
        from travel_platform.telemetry.settings_store import get_telemetry_settings

        tid = str(tenant_id)
        stale_seconds = get_telemetry_settings(tid).driver_stale_seconds
        now = datetime.now(timezone.utc)
        out = []
        for meta in self._vehicles.values():
            if meta.get("tenant_id") != tid:
                continue
            state = self._meta_to_state(meta, stale_seconds=stale_seconds, now=now)
            if state:
                out.append(state)
        return out

    async def list_active_async(self, tenant_id: UUID) -> list[LiveVehicleState]:
        """Memory + Redis (needed when WS is down and HTTP poll hits another worker)."""
        from travel_platform.telemetry.live_fleet_redis import load_live_vehicles
        from travel_platform.telemetry.settings_store import get_telemetry_settings

        tid = str(tenant_id)
        stale_seconds = get_telemetry_settings(tid).driver_stale_seconds
        now = datetime.now(timezone.utc)
        by_id: dict[str, LiveVehicleState] = {}

        for state in self.list_active(tenant_id):
            if state.vehicle_id:
                by_id[state.vehicle_id] = state

        for meta in await load_live_vehicles(tid):
            # Hydrate local cache so subsequent meta lookups work.
            vid = str(meta.get("vehicle_id") or "")
            if vid:
                self._vehicles[vid] = {**self._vehicles.get(vid, {}), **meta}
                code = meta.get("vehicle_code")
                if code:
                    self._code_index[f"{tid}:{code}"] = vid
            state = self._meta_to_state(meta, stale_seconds=stale_seconds, now=now)
            if not state or not state.vehicle_id:
                continue
            prev = by_id.get(state.vehicle_id)
            if not prev or state.updated_at >= prev.updated_at:
                by_id[state.vehicle_id] = state
        return list(by_id.values())

    def list_active_for_admin(self, tenant_id: UUID) -> list[LiveVehicleState]:
        """
        Active vehicles for the admin map.

        Also includes GPS still keyed under the legacy demo tenant
        (…0001) from older driver password-login sessions, so LIVE
        drivers like Achilleas appear before they re-login.
        """
        from travel_platform.operations.master_qr_local import DEFAULT_TENANT

        primary = self.list_active(tenant_id)
        demo = UUID(DEFAULT_TENANT)
        if str(tenant_id) == str(demo):
            return primary

        legacy = self.list_active(demo)
        if not legacy:
            return primary

        seen_ids = {v.vehicle_id for v in primary if v.vehicle_id}
        seen_codes = {v.vehicle_code for v in primary if v.vehicle_code}
        merged = list(primary)
        for v in legacy:
            if v.vehicle_id and v.vehicle_id in seen_ids:
                continue
            if v.vehicle_code and v.vehicle_code in seen_codes:
                continue
            merged.append(v)
        return merged

    async def list_active_for_admin_async(self, tenant_id: UUID) -> list[LiveVehicleState]:
        from travel_platform.operations.master_qr_local import DEFAULT_TENANT

        primary = await self.list_active_async(tenant_id)
        demo = UUID(DEFAULT_TENANT)
        if str(tenant_id) == str(demo):
            return primary

        legacy = await self.list_active_async(demo)
        if not legacy:
            return primary

        seen_ids = {v.vehicle_id for v in primary if v.vehicle_id}
        seen_codes = {v.vehicle_code for v in primary if v.vehicle_code}
        merged = list(primary)
        for v in legacy:
            if v.vehicle_id and v.vehicle_id in seen_ids:
                continue
            if v.vehicle_code and v.vehicle_code in seen_codes:
                continue
            merged.append(v)
        return merged

    def vehicle_meta(self, tenant_id: UUID, vehicle_id: str) -> dict:
        meta = self._vehicles.get(vehicle_id, {})
        if meta.get("tenant_id") != str(tenant_id):
            return {}
        return meta

    async def vehicle_meta_async(self, tenant_id: UUID, vehicle_id: str) -> dict:
        local = self.vehicle_meta(tenant_id, vehicle_id)
        if local.get("lat") is not None:
            return local
        from travel_platform.telemetry.live_fleet_redis import load_live_vehicle

        remote = await load_live_vehicle(str(tenant_id), vehicle_id)
        if remote.get("tenant_id") and remote.get("tenant_id") != str(tenant_id):
            # Allow legacy demo rows when looking up by id during admin merge.
            pass
        if remote:
            self._vehicles[vehicle_id] = {**self._vehicles.get(vehicle_id, {}), **remote}
        return remote or local

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
