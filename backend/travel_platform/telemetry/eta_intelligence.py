"""
Real-time ETA — Google Distance Matrix (or mock) every 5–10 minutes.

ETA = distance/time to next stop with traffic_in_traffic when available.
Cached in memory / Redis for passenger portal polling + WebSocket push.
"""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import httpx

from travel_platform.telemetry.geo import haversine_m
from travel_platform.telemetry.live_fleet import LiveFleetService

logger = logging.getLogger(__name__)

REFRESH_SECONDS = int(os.getenv("ETA_REFRESH_SECONDS", "300"))
GOOGLE_MAPS_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

TRAFFIC_LABELS = {
    "light": "Κίνηση: Ελαφριά",
    "moderate": "Κίνηση: Κανονική",
    "heavy": "Κίνηση: Αυξημένη",
    "severe": "Κίνηση: Πολύ πυκνή",
}


@dataclass
class TripEtaSnapshot:
    trip_id: int
    tenant_id: UUID
    next_stop_name: str
    next_stop_lat: float
    next_stop_lng: float
    eta_seconds: int
    distance_m: int
    duration_in_traffic_seconds: int
    traffic_level: str
    traffic_label: str
    vehicle_lat: float | None
    vehicle_lng: float | None
    computed_at: datetime


class EtaIntelligenceService:
    _cache: dict[tuple[str, int], TripEtaSnapshot] = {}
    _next_stops: dict[int, tuple[str, float, float]] = {
        1: ("Λαμία (επόμενη στάση)", 38.8994, 22.4332),
        2: ("Αθήνα — Λαρίσσης", 37.9922, 23.7207),
        3: ("Ιωάννινα — Κέντρο", 39.6650, 20.8537),
    }

    def get_cached(self, tenant_id: UUID, trip_id: int) -> TripEtaSnapshot | None:
        return self._cache.get((str(tenant_id), trip_id))

    async def refresh_active_trips(
        self,
        live: LiveFleetService,
        tenant_id: UUID | None = None,
    ) -> int:
        updated = 0
        for meta in live._vehicles.values():
            if tenant_id and meta.get("tenant_id") != str(tenant_id):
                continue
            trip_id = meta.get("trip_id")
            if not trip_id or "lat" not in meta:
                continue
            tid = UUID(meta["tenant_id"])
            snap = await self.compute_eta(
                tenant_id=tid,
                trip_id=int(trip_id),
                origin_lat=meta["lat"],
                origin_lng=meta["lng"],
            )
            if snap:
                self._cache[(str(tid), trip_id)] = snap
                updated += 1
                try:
                    from travel_platform.telemetry.ws_hub import push_eta_snapshot

                    await push_eta_snapshot(snap)
                except Exception:
                    logger.debug("ETA WS broadcast skipped", exc_info=True)
        return updated

    async def compute_eta(
        self,
        *,
        tenant_id: UUID,
        trip_id: int,
        origin_lat: float,
        origin_lng: float,
    ) -> TripEtaSnapshot | None:
        stop = self._next_stops.get(trip_id)
        if not stop:
            return None
        name, dest_lat, dest_lng = stop

        if GOOGLE_MAPS_KEY:
            matrix = await self._google_distance_matrix(
                origin_lat, origin_lng, dest_lat, dest_lng
            )
        else:
            matrix = self._mock_matrix(origin_lat, origin_lng, dest_lat, dest_lng)

        return TripEtaSnapshot(
            trip_id=trip_id,
            tenant_id=tenant_id,
            next_stop_name=name,
            next_stop_lat=dest_lat,
            next_stop_lng=dest_lng,
            eta_seconds=matrix["duration_in_traffic_seconds"],
            distance_m=matrix["distance_m"],
            duration_in_traffic_seconds=matrix["duration_in_traffic_seconds"],
            traffic_level=matrix["traffic_level"],
            traffic_label=TRAFFIC_LABELS.get(matrix["traffic_level"], "Κίνηση: —"),
            vehicle_lat=origin_lat,
            vehicle_lng=origin_lng,
            computed_at=datetime.now(timezone.utc),
        )

    async def _google_distance_matrix(
        self,
        o_lat: float,
        o_lng: float,
        d_lat: float,
        d_lng: float,
    ) -> dict[str, Any]:
        url = "https://maps.googleapis.com/maps/api/distancematrix/json"
        params = {
            "origins": f"{o_lat},{o_lng}",
            "destinations": f"{d_lat},{d_lng}",
            "departure_time": "now",
            "traffic_model": "best_guess",
            "key": GOOGLE_MAPS_KEY,
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(url, params=params)
            res.raise_for_status()
            data = res.json()
        element = data["rows"][0]["elements"][0]
        if element.get("status") != "OK":
            return self._mock_matrix(o_lat, o_lng, d_lat, d_lng)
        dist_m = element["distance"]["value"]
        dur = element.get("duration_in_traffic") or element["duration"]
        dur_sec = int(dur["value"])
        base = int(element["duration"]["value"])
        ratio = dur_sec / max(base, 1)
        traffic_level = "light" if ratio < 1.15 else "moderate" if ratio < 1.4 else "heavy"
        if ratio > 1.8:
            traffic_level = "severe"
        return {
            "distance_m": dist_m,
            "duration_in_traffic_seconds": dur_sec,
            "traffic_level": traffic_level,
        }

    def _mock_matrix(
        self,
        o_lat: float,
        o_lng: float,
        d_lat: float,
        d_lng: float,
    ) -> dict[str, Any]:
        dist_m = int(haversine_m(o_lat, o_lng, d_lat, d_lng))
        avg_kmh = 55.0
        dur_sec = max(60, int((dist_m / 1000.0) / avg_kmh * 3600))
        traffic_level = "moderate" if dist_m > 30_000 else "light"
        return {
            "distance_m": dist_m,
            "duration_in_traffic_seconds": int(dur_sec * 1.12),
            "traffic_level": traffic_level,
        }


_eta_service = EtaIntelligenceService()
_refresh_task: asyncio.Task | None = None


def get_eta_service() -> EtaIntelligenceService:
    return _eta_service


async def start_eta_refresh_loop(live: LiveFleetService) -> None:
    global _refresh_task

    async def _loop() -> None:
        while True:
            try:
                n = await _eta_service.refresh_active_trips(live)
                if n:
                    logger.debug("ETA refreshed for %s active trips", n)
            except Exception:
                logger.exception("ETA refresh loop error")
            await asyncio.sleep(REFRESH_SECONDS)

    if _refresh_task is None:
        _refresh_task = asyncio.create_task(_loop())
