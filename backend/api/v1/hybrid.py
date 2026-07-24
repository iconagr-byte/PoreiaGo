"""REST endpoints for hybrid trip / flight module."""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_actor_id, get_tenant_db, get_tenant_id
from schemas.platform.hybrid import (
    FlightResponse,
    FlightUpsertRequest,
    HybridMetaUpsertRequest,
    HybridTripResponse,
    LuggageReplaceRequest,
    LuggageUpsertRequest,
    PassengerSeatUpsertRequest,
    PassengerSeatsReplaceRequest,
    SegmentResponse,
    SegmentsReplaceRequest,
    YieldCalculateRequest,
)
from travel_platform.operations.hybrid_trip import HybridTripService

router = APIRouter()


def _svc(
    session: AsyncSession,
    tenant_id: UUID,
    actor_id: str | None,
) -> HybridTripService:
    return HybridTripService(session, tenant_id, actor_id=actor_id)


@router.get("/trips/{trip_id}/hybrid", response_model=HybridTripResponse)
async def get_hybrid_trip(
    trip_id: int,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
):
    data = await _svc(session, tenant_id, actor_id).get_hybrid_trip(trip_id)
    return HybridTripResponse(**data)


@router.get("/trips/{trip_id}/flights", response_model=list[FlightResponse])
async def list_flights(
    trip_id: int,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
):
    flights = await _svc(session, tenant_id, actor_id).list_flights(trip_id)
    return [FlightResponse(**f.to_dict()) for f in flights]


@router.post("/trips/{trip_id}/flights", response_model=FlightResponse)
async def upsert_flight(
    trip_id: int,
    body: FlightUpsertRequest,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
):
    try:
        rec = await _svc(session, tenant_id, actor_id).upsert_flight(trip_id, body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return FlightResponse(**rec.to_dict())


@router.delete("/trips/{trip_id}/flights/{flight_id}")
async def delete_flight(
    trip_id: int,
    flight_id: UUID,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
):
    await _svc(session, tenant_id, actor_id).delete_flight(trip_id, flight_id)
    return {"ok": True, "flight_id": str(flight_id)}


@router.get("/trips/{trip_id}/segments", response_model=list[SegmentResponse])
async def list_segments(
    trip_id: int,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
):
    segs = await _svc(session, tenant_id, actor_id).list_segments(trip_id)
    return [SegmentResponse(**s.to_dict()) for s in segs]


@router.put("/trips/{trip_id}/segments", response_model=list[SegmentResponse])
async def replace_segments(
    trip_id: int,
    body: SegmentsReplaceRequest,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
):
    segs = await _svc(session, tenant_id, actor_id).replace_segments(
        trip_id, [s.model_dump() for s in body.segments]
    )
    return [SegmentResponse(**s.to_dict()) for s in segs]


@router.post("/trips/{trip_id}/passenger-seats")
async def upsert_passenger_seat(
    trip_id: int,
    body: PassengerSeatUpsertRequest,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
):
    return await _svc(session, tenant_id, actor_id).upsert_passenger_seat(trip_id, body.model_dump())


@router.put("/trips/{trip_id}/passenger-seats")
async def replace_passenger_seats(
    trip_id: int,
    body: PassengerSeatsReplaceRequest,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
):
    return await _svc(session, tenant_id, actor_id).replace_passenger_seats(
        trip_id, [s.model_dump() for s in body.seats]
    )


@router.get("/trips/{trip_id}/luggage")
async def list_luggage(
    trip_id: int,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
):
    return await _svc(session, tenant_id, actor_id).list_luggage(trip_id)


@router.post("/trips/{trip_id}/luggage")
async def upsert_luggage(
    trip_id: int,
    body: LuggageUpsertRequest,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
):
    return await _svc(session, tenant_id, actor_id).upsert_luggage(trip_id, body.model_dump())


@router.put("/trips/{trip_id}/luggage")
async def replace_luggage(
    trip_id: int,
    body: LuggageReplaceRequest,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
):
    return await _svc(session, tenant_id, actor_id).replace_luggage(
        trip_id, [i.model_dump() for i in body.items]
    )


@router.get("/trips/{trip_id}/meta")
async def get_hybrid_meta(
    trip_id: int,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
):
    return await _svc(session, tenant_id, actor_id).get_trip_meta(trip_id)


@router.put("/trips/{trip_id}/meta")
async def upsert_hybrid_meta(
    trip_id: int,
    body: HybridMetaUpsertRequest,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
):
    return await _svc(session, tenant_id, actor_id).upsert_trip_meta(trip_id, body.model_dump())


@router.post("/flights/{flight_id}/status/poll")
async def poll_flight_status(
    flight_id: UUID,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
):
    try:
        return await _svc(session, tenant_id, actor_id).poll_flight_status(flight_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/flights/{flight_id}/notify-delay")
async def notify_flight_delay(
    flight_id: UUID,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
    body: dict[str, Any] | None = None,
):
    payload = body or {}
    try:
        return await _svc(session, tenant_id, actor_id).queue_delay_notifications(
            flight_id,
            trip_id=payload.get("trip_id"),
            delay_minutes=int(payload.get("delay_minutes") or 0),
            channels=payload.get("channels"),
            recipients=payload.get("recipients"),
            trip_title=payload.get("trip_title"),
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/hybrid/yield")
async def calculate_yield(body: YieldCalculateRequest) -> dict[str, Any]:
    return HybridTripService.calculate_yield(
        flights=body.flights,
        segments=body.segments,
        passenger_count=body.passenger_count,
        target_margin_pct=body.target_margin_pct,
        fx_rates_to_eur=body.fx_rates_to_eur,
        display_currency=body.display_currency,
    )
