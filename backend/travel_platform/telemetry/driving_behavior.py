"""
Driving behavior score — prefer Teltonika tracker_event_id over raw G-force math.

Expert note: modern trackers emit event IDs (e.g. 101 = harsh braking).
Ingest those directly to save CPU; use accel axes only as fallback.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from travel_platform.telemetry.domain import DrivingBehaviorEvent, TelemetryUpdate

logger = logging.getLogger(__name__)

# Teltonika-style mapping (extend per device firmware)
TRACKER_EVENT_MAP: dict[int, tuple[str, int]] = {
    101: ("HARSH_BRAKING", 8),
    102: ("HARSH_ACCELERATION", 6),
    103: ("HARSH_CORNERING", 5),
    104: ("EXCESSIVE_IDLING", 2),
    105: ("SPEEDING", 10),
}

G_SPIKE_THRESHOLD = 0.45
G_SPIKE_PENALTY = 5


@dataclass
class DriverSafetyState:
    driver_id: UUID
    safety_score: int = 100
    events_last_30d: int = 0
    distance_km_30d: float = 0.0
    events_per_100km: float = 0.0
    last_event_at: datetime | None = None


class DrivingBehaviorService:
    _profiles: dict[str, DriverSafetyState] = {}
    _trip_distance_m: dict[str, float] = {}
    _last_pos: dict[str, tuple[float, float]] = {}

    def process(
        self,
        driver_id: UUID | None,
        vehicle_id: UUID,
        update: TelemetryUpdate,
    ) -> DrivingBehaviorEvent | None:
        if not driver_id:
            driver_id = self._driver_for_vehicle(vehicle_id)

        self._accumulate_distance(str(vehicle_id), update)

        event = self._from_tracker_event(update) or self._from_accel_spike(update)
        if not event:
            return None

        profile = self._profiles.setdefault(
            str(driver_id),
            DriverSafetyState(driver_id=driver_id),
        )
        profile.safety_score = max(0, profile.safety_score - event.score_delta)
        profile.events_last_30d += 1
        profile.last_event_at = update.recorded_at
        profile.distance_km_30d = self._trip_distance_m.get(str(vehicle_id), 0) / 1000.0
        profile.events_per_100km = aggregated_rating_per_100km(
            profile.events_last_30d,
            profile.distance_km_30d,
        )
        logger.info(
            "Driving event %s driver=%s score=%s",
            event.event_type,
            driver_id,
            profile.safety_score,
        )
        return event

    def get_profile(self, driver_id: UUID) -> DriverSafetyState:
        return self._profiles.setdefault(
            str(driver_id),
            DriverSafetyState(driver_id=driver_id),
        )

    def _driver_for_vehicle(self, vehicle_id: UUID) -> UUID:
        return vehicle_id

    def _accumulate_distance(self, vehicle_key: str, update: TelemetryUpdate) -> None:
        prev = self._last_pos.get(vehicle_key)
        self._last_pos[vehicle_key] = (update.latitude, update.longitude)
        if not prev:
            return
        from travel_platform.telemetry.geo import haversine_m

        d = haversine_m(prev[0], prev[1], update.latitude, update.longitude)
        if d < 500:
            self._trip_distance_m[vehicle_key] = self._trip_distance_m.get(vehicle_key, 0) + d

    def _from_tracker_event(self, update: TelemetryUpdate) -> DrivingBehaviorEvent | None:
        raw = update.raw or {}
        eid = raw.get("tracker_event_id")
        if eid is None:
            return None
        try:
            eid = int(eid)
        except (TypeError, ValueError):
            return None
        mapped = TRACKER_EVENT_MAP.get(eid)
        if not mapped:
            return None
        event_type, penalty = mapped
        return DrivingBehaviorEvent(
            event_type=event_type,
            tracker_event_id=eid,
            peak_g=None,
            score_delta=penalty,
            recorded_at=update.recorded_at,
            lat=update.latitude,
            lng=update.longitude,
            speed_kmh=update.speed_kmh,
        )

    def _from_accel_spike(self, update: TelemetryUpdate) -> DrivingBehaviorEvent | None:
        from travel_platform.telemetry.settings_store import get_telemetry_settings

        runtime = get_telemetry_settings()
        raw = update.raw or {}
        if runtime.prefer_tracker_events and raw.get("tracker_event_id"):
            return None
        ax = raw.get("accel_x")
        ay = raw.get("accel_y")
        az = raw.get("accel_z")
        if ax is None or ay is None or az is None:
            return None
        magnitude = math.sqrt(float(ax) ** 2 + float(ay) ** 2 + float(az) ** 2)
        g_force = magnitude / 9.80665
        threshold = runtime.gforce_spike_threshold_g
        deviation = abs(g_force - 1.0)
        if deviation < threshold:
            return None
        event_type = "HARSH_BRAKING" if float(az) < -2.0 else "HARSH_CORNERING"
        return DrivingBehaviorEvent(
            event_type=event_type,
            tracker_event_id=None,
            peak_g=round(deviation, 3),
            score_delta=G_SPIKE_PENALTY,
            recorded_at=update.recorded_at,
            lat=update.latitude,
            lng=update.longitude,
            speed_kmh=update.speed_kmh,
        )


def aggregated_driver_safety_rating(
    *,
    base_score: int = 100,
    events_last_30d: int,
    distance_km_30d: float,
    penalty_per_event: int = 5,
) -> int:
    """
    Aggregate 1–100 rating from historical events normalized per 100 km.
    More events per 100km → lower score.
    """
    if distance_km_30d < 1.0:
        distance_km_30d = 1.0
    per_100 = (events_last_30d / distance_km_30d) * 100.0
    deduction = int(min(80, per_100 * penalty_per_event))
    return max(1, min(100, base_score - deduction))


def aggregated_rating_per_100km(events: int, distance_km: float) -> float:
    if distance_km < 0.1:
        return float(events * 100)
    return round((events / distance_km) * 100.0, 2)
