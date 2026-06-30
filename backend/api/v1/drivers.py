from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from core.dependencies import get_actor_id, get_audit_service, get_tenant_db, get_tenant_id
from travel_platform.compliance.audit_trail import AuditTrailService
from travel_platform.drivers.availability import DriverAvailabilityEngine
from travel_platform.drivers.document_vault import DriverDocumentVaultService
from travel_platform.drivers.domain import DriverStatus, ExpenseCategory, PersonalInfo
from travel_platform.drivers.finance import DriverFinanceService
from travel_platform.drivers.payroll import DriverPayrollService
from travel_platform.drivers.registry import DriverRegistryService
from travel_platform.drivers.stats import DriverStatsService
from schemas.platform.drivers import (
    AssignmentRequest,
    AvailabilityResponse,
    DocumentRegisterRequest,
    DocumentResponse,
    DriverCreateRequest,
    DriverResponse,
    DriverStatsResponse,
    EarningRequest,
    ExpenseRequest,
    PayRateChangeRequest,
    PayoutSummaryResponse,
)
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


def _driver_response(d) -> DriverResponse:
    p = d.personal_info
    return DriverResponse(
        id=str(d.id),
        name=p.name,
        license_no=p.license_no,
        phone=p.phone,
        email=p.email,
        hiring_date=d.hiring_date,
        status=d.status.value,
        salary_per_km=d.salary_per_km,
        salary_per_trip=d.salary_per_trip,
        current_balance=d.current_balance,
        bonus_structure=d.bonus_structure,
    )


@router.get("", response_model=list[DriverResponse])
async def list_drivers(
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    status: str | None = None,
):
    svc = DriverRegistryService(session, tenant_id)
    st = DriverStatus(status) if status else None
    drivers = await svc.list_drivers(status=st)
    return [_driver_response(d) for d in drivers]


@router.post("", response_model=DriverResponse)
async def create_driver(
    body: DriverCreateRequest,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
):
    svc = DriverRegistryService(session, tenant_id, actor_id=actor_id)
    info = PersonalInfo(
        name=body.personal_info.name,
        license_no=body.personal_info.license_no,
        phone=body.personal_info.phone,
        email=str(body.personal_info.email),
    )
    driver = await svc.create_driver(
        info,
        body.hiring_date,
        salary_per_km=body.salary_per_km,
        salary_per_trip=body.salary_per_trip,
        bonus_structure=body.bonus_structure,
    )
    return _driver_response(driver)


@router.get("/{driver_id}", response_model=DriverResponse)
async def get_driver(
    driver_id: UUID,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
):
    svc = DriverRegistryService(session, tenant_id)
    return _driver_response(await svc.get_driver(driver_id))


@router.get("/{driver_id}/stats", response_model=DriverStatsResponse)
async def get_driver_stats(
    driver_id: UUID,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    refresh: bool = Query(False, description="Force cache recompute"),
):
    svc = DriverStatsService(session, tenant_id)
    snap = await svc.get_stats(driver_id, force_refresh=refresh)
    return DriverStatsResponse(
        driver_id=str(snap.driver_id),
        total_kms_driven=snap.total_kms_driven,
        total_hours_driven=snap.total_hours_driven,
        assignments_count=snap.assignments_count,
        avg_passenger_rating=snap.avg_passenger_rating,
        rating_percentile=snap.rating_percentile,
        trips_completed=snap.trips_completed,
        feedback_count=snap.feedback_count,
        computed_at=snap.computed_at,
        cache_hit=snap.cache_hit,
    )


@router.get("/{driver_id}/documents", response_model=list[DocumentResponse])
async def list_documents(
    driver_id: UUID,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
):
    svc = DriverDocumentVaultService(session, tenant_id)
    docs = await svc.list_documents(driver_id)
    return [
        DocumentResponse(
            id=str(d.id),
            doc_type=d.doc_type,
            storage_key=d.storage_key,
            expires_at=d.expires_at,
            days_until_expiry=d.days_until_expiry,
            alert_required=d.alert_required,
        )
        for d in docs
    ]


@router.post("/{driver_id}/documents", response_model=DocumentResponse)
async def register_document(
    driver_id: UUID,
    body: DocumentRegisterRequest,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
):
    svc = DriverDocumentVaultService(session, tenant_id, actor_id=actor_id)
    doc = await svc.register_document(
        driver_id, body.doc_type, body.storage_key, body.expires_at, file_name=body.file_name
    )
    return DocumentResponse(
        id=str(doc.id),
        doc_type=doc.doc_type,
        storage_key=doc.storage_key,
        expires_at=doc.expires_at,
        days_until_expiry=doc.days_until_expiry,
        alert_required=doc.alert_required,
    )


@router.post("/{driver_id}/earnings")
async def record_earning(
    driver_id: UUID,
    body: EarningRequest,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
    audit: Annotated[AuditTrailService, Depends(get_audit_service)],
):
    svc = DriverFinanceService(session, tenant_id, audit=audit, actor_id=actor_id)
    eid = await svc.record_earning(
        driver_id,
        body.amount,
        trip_id=body.trip_id,
        earning_type=body.earning_type,
        description=body.description,
        idempotency_key=body.idempotency_key,
    )
    return {"id": str(eid)}


@router.post("/{driver_id}/expenses")
async def record_expense(
    driver_id: UUID,
    body: ExpenseRequest,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
    audit: Annotated[AuditTrailService, Depends(get_audit_service)],
):
    svc = DriverFinanceService(session, tenant_id, audit=audit, actor_id=actor_id)
    xid = await svc.record_expense(
        driver_id,
        body.amount,
        ExpenseCategory(body.category),
        trip_id=body.trip_id,
        description=body.description,
        receipt_ref=body.receipt_ref,
        idempotency_key=body.idempotency_key,
    )
    return {"id": str(xid)}


@router.post("/{driver_id}/pay-rates")
async def change_pay_rate(
    driver_id: UUID,
    body: PayRateChangeRequest,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
    audit: Annotated[AuditTrailService, Depends(get_audit_service)],
):
    svc = DriverFinanceService(session, tenant_id, audit=audit, actor_id=actor_id)
    rid = await svc.set_pay_rate(
        driver_id,
        salary_per_km=body.salary_per_km,
        salary_per_trip=body.salary_per_trip,
        bonus_structure=body.bonus_structure,
        change_reason=body.change_reason,
    )
    return {"pay_rate_id": str(rid)}


@router.get("/{driver_id}/payout-summary", response_model=PayoutSummaryResponse)
async def payout_summary(
    driver_id: UUID,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    year: int = Query(..., ge=2020),
    month: int = Query(..., ge=1, le=12),
):
    svc = DriverPayrollService(session, tenant_id)
    summary = await svc.monthly_payout_summary(driver_id, year, month)
    return PayoutSummaryResponse(
        driver_id=str(summary.driver_id),
        period_start=summary.period_start,
        period_end=summary.period_end,
        total_earnings=summary.total_earnings,
        total_expenses=summary.total_expenses,
        advances_and_deductions=summary.advances_and_deductions,
        net_payout=summary.net_payout,
        trip_count=summary.trip_count,
        line_items=summary.line_items,
    )


@router.get("/{driver_id}/payout-summary/export")
async def payout_summary_export(
    driver_id: UUID,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    year: int = Query(..., ge=2020),
    month: int = Query(..., ge=1, le=12),
):
    svc = DriverPayrollService(session, tenant_id)
    return await svc.export_for_accounting(driver_id, year, month)


@router.get("/{driver_id}/availability", response_model=AvailabilityResponse)
async def check_availability(
    driver_id: UUID,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    shift_start: datetime = Query(...),
    shift_end: datetime = Query(...),
):
    svc = DriverAvailabilityEngine(session, tenant_id)
    result = await svc.check_availability(driver_id, shift_start, shift_end)
    return AvailabilityResponse(
        available=result.available,
        reasons=result.reasons,
        conflicting_assignment_ids=result.conflicting_assignment_ids,
    )


@router.post("/{driver_id}/assignments")
async def assign_driver(
    driver_id: UUID,
    body: AssignmentRequest,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
):
    svc = DriverAvailabilityEngine(session, tenant_id, actor_id=actor_id)
    aid = await svc.assign_trip(
        driver_id,
        body.trip_id,
        body.shift_start,
        body.shift_end,
        distance_km=body.distance_km,
    )
    stats = DriverStatsService(session, tenant_id)
    await stats.refresh_cache(driver_id)
    return {"assignment_id": str(aid)}
