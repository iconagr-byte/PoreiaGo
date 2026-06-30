"""
Passenger portal — live ETA for mobile wallet (polling + smooth countdown).
"""

from __future__ import annotations

import os
from uuid import UUID

import jwt
from fastapi import APIRouter, HTTPException, Query

from travel_platform.telemetry.eta_resolve import DEMO_TENANT, resolve_eta_snapshot
from travel_platform.telemetry.eta_serializers import format_eta_display
from travel_platform.telemetry.passenger_track_service import fetch_passenger_track
from travel_platform.telemetry.passenger_track_token import (
    DEFAULT_TTL_HOURS,
    create_passenger_track_token,
    verify_passenger_track_token,
)
from schemas.telemetry import PassengerEtaResponse, PassengerTrackResponse

router = APIRouter(prefix="/api/passenger", tags=["passenger"])


def _resolve_tenant_id(
    *,
    trip_id: int,
    tenant_id: UUID | None,
    token: str | None,
) -> UUID:
    if token:
        try:
            payload = verify_passenger_track_token(token, trip_id=trip_id)
            return UUID(str(payload["tenant_id"]))
        except jwt.PyJWTError as exc:
            raise HTTPException(status_code=401, detail="Invalid track token") from exc

    require_token = os.getenv("PASSENGER_TRACK_REQUIRE_TOKEN", "false").lower() in ("1", "true", "yes")
    if require_token:
        raise HTTPException(status_code=401, detail="Track token required")

    return tenant_id or DEMO_TENANT


@router.get("/trips/{trip_id}/eta", response_model=PassengerEtaResponse)
async def trip_eta(trip_id: int, tenant_id: UUID | None = None):
    """
    Public-ish ETA for passenger countdown.
    Poll every 30s; client interpolates seconds between syncs.
    """
    tid = tenant_id or DEMO_TENANT
    snap = await resolve_eta_snapshot(trip_id, tid)

    if not snap:
        raise HTTPException(status_code=404, detail="ETA not available for trip")

    return PassengerEtaResponse(
        trip_id=trip_id,
        next_stop_name=snap.next_stop_name,
        eta_seconds=snap.eta_seconds,
        eta_display=format_eta_display(snap.eta_seconds),
        distance_m=snap.distance_m,
        traffic_level=snap.traffic_level,
        traffic_label=snap.traffic_label,
        vehicle_lat=snap.vehicle_lat,
        vehicle_lng=snap.vehicle_lng,
        computed_at=snap.computed_at,
        server_sync_interval_sec=30,
    )


@router.get("/trips/{trip_id}/track", response_model=PassengerTrackResponse)
async def trip_live_track(
    trip_id: int,
    tenant_id: UUID | None = None,
    token: str | None = Query(default=None),
):
    """Public live map data — bus position + ETA (optional signed token)."""
    tid = _resolve_tenant_id(trip_id=trip_id, tenant_id=tenant_id, token=token)
    data = await fetch_passenger_track(trip_id=trip_id, tenant_id=tid)
    if not data:
        raise HTTPException(status_code=404, detail="Live tracking not available for trip")
    return PassengerTrackResponse(**data)
