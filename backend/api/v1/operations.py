from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from core.dependencies import get_actor_id, get_tenant_db, get_tenant_id
from travel_platform.operations.master_qr import MasterQrService
from travel_platform.operations.safety_verification import (
    ChecklistItemStatus,
    DEFAULT_SAFETY_CHECKLIST,
    SafetyVerificationService,
)
from schemas.platform.operations import (
    MasterQrExchangeRequest,
    MasterQrExchangeResponse,
    MasterQrIssueRequest,
    MasterQrIssueResponse,
    TripsSyncRequest,
    TripsSyncResponse,
    SafetyChecklistSubmit,
    SafetyStartRequest,
    SafetyVerificationResponse,
)
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.get("/safety-checklist/template")
async def safety_checklist_template():
    return {
        "items": [
            {"key": i.key, "label": i.label, "required": i.required}
            for i in DEFAULT_SAFETY_CHECKLIST
        ]
    }


@router.post("/master-qr", response_model=MasterQrIssueResponse)
async def issue_master_qr(
    body: MasterQrIssueRequest,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
):
    svc = MasterQrService(session, tenant_id, actor_id=actor_id)
    payload = await svc.issue_for_trip(body.trip_id, driver_id=body.driver_id, issued_by=actor_id)
    return MasterQrIssueResponse(
        qr_payload=payload.auth_url,
        trip_id=payload.trip_id,
        expires_at=payload.expires_at,
        manifest_url=payload.manifest_url,
    )


@router.post("/master-qr/exchange", response_model=MasterQrExchangeResponse)
async def exchange_master_qr(
    body: MasterQrExchangeRequest,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
):
    svc = MasterQrService(session, tenant_id)
    result = await svc.exchange_for_driver_session(body.qr_raw)
    return MasterQrExchangeResponse(**result)


@router.post("/trips/sync", response_model=TripsSyncResponse)
async def sync_trips(
    body: TripsSyncRequest,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
):
    from travel_platform.operations.trips_sync import sync_trips_to_postgres

    payload = [t.model_dump() for t in body.trips]
    result = await sync_trips_to_postgres(payload, tenant_id=str(tenant_id))
    return TripsSyncResponse(**result)


@router.post("/safety-checklist/start", response_model=SafetyVerificationResponse)
async def start_safety_check(
    body: SafetyStartRequest,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
):
    svc = SafetyVerificationService(session, tenant_id, actor_id=actor_id)
    rec = await svc.start_verification(body.trip_id, body.driver_id)
    return SafetyVerificationResponse(
        id=str(rec.id),
        trip_id=rec.trip_id,
        status=rec.status.value,
        items=rec.items,
    )


@router.post("/safety-checklist/submit", response_model=SafetyVerificationResponse)
async def submit_safety_check(
    body: SafetyChecklistSubmit,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
):
    from uuid import UUID as PyUUID

    svc = SafetyVerificationService(session, tenant_id, actor_id=actor_id)
    items = {k: ChecklistItemStatus(v) for k, v in body.items.items()}
    rec = await svc.submit_checklist(PyUUID(body.verification_id), items, notes=body.notes)
    return SafetyVerificationResponse(
        id=str(rec.id),
        trip_id=rec.trip_id,
        status=rec.status.value,
        items=rec.items,
    )
