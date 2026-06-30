from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import TelemetryAcceptedResponse, TelemetryUpdateRequest
from app.core.auth_deps import get_telemetry_db, get_telemetry_tenant_id
from app.services.telemetry_service import TelemetryService

router = APIRouter(prefix="/telemetry", tags=["SaaS Telemetry"])


@router.post("/update", response_model=TelemetryAcceptedResponse, status_code=status.HTTP_202_ACCEPTED)
async def telemetry_update(
    body: TelemetryUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_telemetry_db)],
    tenant_id: Annotated[UUID, Depends(get_telemetry_tenant_id)],
):
    payload = body.model_dump()
    position, events = await TelemetryService(db).process_update(
        tenant_id=tenant_id,
        trip_id=body.trip_id,
        payload=payload,
    )
    return TelemetryAcceptedResponse(
        geofence_events=[
            {
                "stop_id": str(e.stop_id),
                "stop_name": e.stop_name,
                "event": e.event,
                "distance_m": e.distance_m,
            }
            for e in events
        ],
    )
