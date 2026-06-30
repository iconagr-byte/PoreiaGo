"""
Corridor geofence — unauthorized route detection.

Production: PostGIS ST_DWithin(buffered linestring) with GIST index.
Dev / no DB: haversine point-to-segment distance vs polyline + buffer (50–100m).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from travel_platform.telemetry.domain import RouteDeviationAlert, TelemetryUpdate
from travel_platform.telemetry.geo import haversine_m, point_to_polyline_distance_m

logger = logging.getLogger(__name__)

DEFAULT_BUFFER_M = 75
MIN_SPEED_FOR_CHECK_KMH = 8.0
CONSECUTIVE_OFF_POINTS = 3


@dataclass(frozen=True)
class CorridorZone:
    trip_id: int
    name: str
    points: list[tuple[float, float]]
    buffer_m: int = DEFAULT_BUFFER_M


class CorridorGeofenceService:
    """
    Alert when vehicle leaves planned route corridor.
    Debounce: require N consecutive off-corridor points to avoid GPS jitter.
    """

    _zones: dict[tuple[str, int], CorridorZone] = {}
    _off_streak: dict[str, int] = {}
    _last_on_corridor: dict[str, bool] = {}

    @classmethod
    def register_corridor(
        cls,
        tenant_id: UUID,
        trip_id: int,
        points: list[tuple[float, float]],
        *,
        buffer_m: int = DEFAULT_BUFFER_M,
        name: str = "main_corridor",
    ) -> None:
        cls._zones[(str(tenant_id), trip_id)] = CorridorZone(
            trip_id=trip_id,
            name=name,
            points=points,
            buffer_m=buffer_m,
        )

    @classmethod
    def default_corridor(cls, tenant_id: UUID, trip_id: int) -> CorridorZone | None:
        key = (str(tenant_id), trip_id)
        if key in cls._zones:
            return cls._zones[key]
        if trip_id != 1:
            return None
        from travel_platform.telemetry.settings_store import get_telemetry_settings

        buf = get_telemetry_settings(str(tenant_id)).corridor_buffer_m
        cls.register_corridor(
            tenant_id,
            trip_id,
            [
                (37.9922, 23.7207),
                (38.45, 23.2),
                (38.8994, 22.4332),
                (39.35, 22.0),
                (39.7217, 21.6306),
            ],
            buffer_m=buf,
        )
        return cls._zones[key]

    def evaluate(
        self,
        tenant_id: UUID,
        vehicle_id: UUID,
        update: TelemetryUpdate,
    ) -> RouteDeviationAlert | None:
        from travel_platform.telemetry.settings_store import get_telemetry_settings

        runtime = get_telemetry_settings(str(tenant_id))
        if not update.trip_id or update.speed_kmh < runtime.corridor_min_speed_kmh:
            return None
        zone = self.default_corridor(tenant_id, update.trip_id)
        if not zone or len(zone.points) < 2:
            return None

        buffer_m = runtime.corridor_buffer_m
        vid = str(vehicle_id)
        dist_m = point_to_polyline_distance_m(
            update.latitude,
            update.longitude,
            zone.points,
        )
        on_corridor = dist_m <= buffer_m

        if on_corridor:
            self._off_streak[vid] = 0
            self._last_on_corridor[vid] = True
            return None

        streak = self._off_streak.get(vid, 0) + 1
        self._off_streak[vid] = streak
        if streak < runtime.corridor_debounce_points:
            return None

        outside_m = dist_m - buffer_m
        logger.warning(
            "ROUTE DEVIATION trip=%s vehicle=%s outside=%.0fm",
            update.trip_id,
            vehicle_id,
            outside_m,
        )
        self._off_streak[vid] = 0
        return RouteDeviationAlert(
            tenant_id=tenant_id,
            vehicle_id=vehicle_id,
            trip_id=update.trip_id,
            lat=update.latitude,
            lng=update.longitude,
            distance_outside_m=outside_m,
            buffer_m=buffer_m,
            detected_at=update.recorded_at,
            message=f"Αποκλίνουσα διαδρομή — {outside_m:.0f}m εκτός διαδρόμου",
        )

    async def evaluate_postgis(
        self,
        session,
        tenant_id: UUID,
        vehicle_id: UUID,
        update: TelemetryUpdate,
    ) -> RouteDeviationAlert | None:
        """Call when async SQLAlchemy session + PostGIS available."""
        from travel_platform.telemetry.postgis_queries import DISTANCE_TO_ROUTE_SQL

        if not update.trip_id:
            return None
        row = await session.execute(
            DISTANCE_TO_ROUTE_SQL,
            {
                "tenant_id": str(tenant_id),
                "trip_id": update.trip_id,
                "lat": update.latitude,
                "lng": update.longitude,
            },
        )
        dist_m = float(row.scalar() or 0)
        zone = self.default_corridor(tenant_id, update.trip_id)
        buffer_m = zone.buffer_m if zone else DEFAULT_BUFFER_M
        if dist_m <= buffer_m:
            return None
        return RouteDeviationAlert(
            tenant_id=tenant_id,
            vehicle_id=vehicle_id,
            trip_id=update.trip_id,
            lat=update.latitude,
            lng=update.longitude,
            distance_outside_m=dist_m - buffer_m,
            buffer_m=buffer_m,
            detected_at=update.recorded_at,
            message=f"Αποκλίνουσα διαδρομή — {dist_m - buffer_m:.0f}m εκτός διαδρόμου",
        )
