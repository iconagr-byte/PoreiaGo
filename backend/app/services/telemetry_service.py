"""
Telemetry pipeline — normalize GPS payloads, geofence against Stop locations.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class NormalizedPosition:
    vehicle_id: str
    lat: float
    lng: float
    speed_kmh: float | None
    heading: float | None
    recorded_at: str
    raw: dict[str, Any]


@dataclass(frozen=True)
class GeofenceEvent:
    stop_id: UUID
    stop_name: str
    event: str  # enter | exit
    distance_m: float


class TelemetryService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._settings = get_settings()

    def normalize_payload(self, payload: dict[str, Any]) -> NormalizedPosition:
        """Accept Teltonika / generic tracker JSON."""
        lat = float(payload.get("lat") or payload.get("latitude") or 0)
        lng = float(payload.get("lng") or payload.get("lon") or payload.get("longitude") or 0)
        vehicle_id = str(
            payload.get("vehicle_id")
            or payload.get("imei")
            or payload.get("device_id")
            or "unknown"
        )
        return NormalizedPosition(
            vehicle_id=vehicle_id,
            lat=lat,
            lng=lng,
            speed_kmh=_optional_float(payload.get("speed") or payload.get("speed_kmh")),
            heading=_optional_float(payload.get("heading") or payload.get("course")),
            recorded_at=str(payload.get("ts") or payload.get("timestamp") or ""),
            raw=payload,
        )

    async def process_update(
        self,
        *,
        tenant_id: UUID,
        trip_id: UUID | None,
        payload: dict[str, Any],
    ) -> tuple[NormalizedPosition, list[GeofenceEvent]]:
        position = self.normalize_payload(payload)
        events = await self.check_geofences(
            tenant_id=tenant_id,
            trip_id=trip_id,
            lat=position.lat,
            lng=position.lng,
        )
        return position, events

    async def check_geofences(
        self,
        *,
        tenant_id: UUID,
        trip_id: UUID | None,
        lat: float,
        lng: float,
    ) -> list[GeofenceEvent]:
        radius = self._settings.geofence_radius_m
        stmt = text(
            """
            SELECT id, name,
                   ST_Distance(
                     location::geography,
                     ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                   ) AS distance_m
            FROM stops
            WHERE tenant_id = :tenant_id
              AND (:trip_id IS NULL OR trip_id = :trip_id)
              AND ST_DWithin(
                    location::geography,
                    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                    :radius
                  )
            ORDER BY distance_m ASC
            LIMIT 5
            """
        )
        result = await self._session.execute(
            stmt,
            {
                "tenant_id": str(tenant_id),
                "trip_id": str(trip_id) if trip_id else None,
                "lat": lat,
                "lng": lng,
                "radius": radius,
            },
        )
        events: list[GeofenceEvent] = []
        for row in result.mappings():
            events.append(
                GeofenceEvent(
                    stop_id=UUID(str(row["id"])),
                    stop_name=str(row["name"]),
                    event="enter",
                    distance_m=float(row["distance_m"]),
                )
            )
        if events:
            logger.info(
                "Geofence tenant=%s trip=%s hits=%d",
                tenant_id,
                trip_id,
                len(events),
            )
        return events

    @staticmethod
    def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        r = 6_371_000
        p1, p2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlmb = math.radians(lng2 - lng1)
        a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
        return 2 * r * math.asin(math.sqrt(a))


def _optional_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
