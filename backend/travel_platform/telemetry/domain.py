from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID


class EngineStatus(str, Enum):
    OFF = "off"
    ON = "on"
    IDLE = "idle"


@dataclass(frozen=True)
class TelemetryUpdate:
    vehicle_code: str
    tenant_id: UUID
    trip_id: int | None
    latitude: float
    longitude: float
    speed_kmh: float
    engine_on: bool
    fuel_level_pct: float | None
    recorded_at: datetime
    raw: dict[str, Any]


@dataclass
class NormalizedTelemetry:
    update: TelemetryUpdate
    vehicle_id: UUID
    matched_stop_id: int | None
    stop_arrival_triggered: bool
    route_deviation: bool = False
    driving_event: bool = False


@dataclass
class IdleAlert:
    vehicle_id: UUID
    trip_id: int | None
    duration_seconds: int
    fuel_wasted_liters: float
    idle_cost_eur: float
    message: str


@dataclass
class LiveVehicleState:
    vehicle_id: str
    vehicle_code: str
    trip_id: int | None
    lat: float
    lng: float
    speed_kmh: float
    engine_on: bool
    fuel_level_pct: float | None
    idle_seconds_trip: int
    updated_at: datetime


@dataclass
class RouteDeviationAlert:
    tenant_id: UUID
    vehicle_id: UUID
    trip_id: int
    lat: float
    lng: float
    distance_outside_m: float
    buffer_m: int
    detected_at: datetime
    message: str


@dataclass
class DrivingBehaviorEvent:
    event_type: str
    tracker_event_id: int | None
    peak_g: float | None
    score_delta: int
    recorded_at: datetime
    lat: float
    lng: float
    speed_kmh: float
