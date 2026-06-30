"""
Geofence — auto 'Stop Arrival' when GPS enters scheduled stop radius (default 50m).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from travel_platform.telemetry.domain import TelemetryUpdate
from travel_platform.telemetry.geo import inside_geofence

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class TripStop:
    id: int
    trip_id: int
    sequence_no: int
    name: str
    lat: float
    lng: float
    radius_m: int
    arrived_at: datetime | None


class GeofenceService:
    """Match coordinates to trip stops; trigger arrival once per stop."""

    _arrived_cache: set[tuple[str, int]] = set()  # (vehicle_id, stop_id)
    _stops_by_trip: dict[tuple[str, int], list[TripStop]] = {}

    @classmethod
    def seed_stops(cls, tenant_id: UUID, trip_id: int, stops: list[TripStop]) -> None:
        cls._stops_by_trip[(str(tenant_id), trip_id)] = stops

    @classmethod
    def default_stops_for_trip(cls, tenant_id: UUID, trip_id: int) -> list[TripStop]:
        """Demo stops until loaded from DB."""
        key = (str(tenant_id), trip_id)
        if key in cls._stops_by_trip:
            return cls._stops_by_trip[key]
        return [
            TripStop(1, trip_id, 1, "Αθήνα — Λαρίσσης", 37.9922, 23.7207, 50, None),
            TripStop(2, trip_id, 2, "Λαμία", 38.8994, 22.4332, 50, None),
            TripStop(3, trip_id, 3, "Μετέωρα", 39.7217, 21.6306, 50, None),
        ]

    def check_arrival(
        self,
        tenant_id: UUID,
        vehicle_id: UUID,
        update: TelemetryUpdate,
    ) -> TripStop | None:
        if not update.trip_id:
            return None
        stops = self.default_stops_for_trip(tenant_id, update.trip_id)
        cache_key_prefix = str(vehicle_id)

        for stop in stops:
            if stop.arrived_at:
                continue
            key = (cache_key_prefix, stop.id)
            if key in self._arrived_cache:
                continue
            if inside_geofence(
                update.latitude,
                update.longitude,
                stop.lat,
                stop.lng,
                stop.radius_m,
            ):
                self._arrived_cache.add(key)
                logger.info(
                    "Stop arrival trip=%s stop=%s vehicle=%s",
                    update.trip_id,
                    stop.name,
                    vehicle_id,
                )
                return stop
        return None
