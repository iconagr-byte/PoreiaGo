"""Compliance — unified audit trail + GDPR export/erase."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import (
    AuditLogListResponse,
    AuditLogResponse,
    GdprEraseResponse,
    GdprExportResponse,
    GdprSubjectRequest,
)
from app.core.auth_deps import (
    get_client_ip,
    get_current_tenant_id,
    get_current_user_id,
    get_tenant_db,
    require_roles,
)
from app.models.audit import AuditAction
from app.models.user import User, UserRole
from app.services.audit_service import AuditService, audit_log_to_dict
from app.services.gdpr_service import GdprService

router = APIRouter(prefix="/compliance", tags=["Compliance & GDPR"])

_READ_ROLES = (UserRole.TENANT_ADMIN, UserRole.AUDITOR, UserRole.SUPERADMIN)
_GDPR_WRITE_ROLES = (UserRole.TENANT_ADMIN, UserRole.SUPERADMIN)


async def _actor_email(session: AsyncSession, user_id: UUID) -> str | None:
    result = await session.execute(select(User.email).where(User.id == user_id))
    return result.scalar_one_or_none()


@router.get("/audit", response_model=AuditLogListResponse)
async def list_audit_logs(
    db: Annotated[AsyncSession, Depends(get_tenant_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    _: Annotated[None, Depends(require_roles(*_READ_ROLES))],
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    resource_type: str | None = None,
    resource_id: str | None = None,
    action: str | None = None,
):
    action_enum = None
    if action:
        try:
            action_enum = AuditAction(action)
        except ValueError as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Invalid action: {action}") from exc

    entries, total = await AuditService(db).list_logs(
        tenant_id,
        resource_type=resource_type,
        resource_id=resource_id,
        action=action_enum,
        limit=limit,
        offset=offset,
    )
    return AuditLogListResponse(
        items=[AuditLogResponse(**audit_log_to_dict(e)) for e in entries],
        total=total,
        offset=offset,
        limit=limit,
    )


@router.post("/gdpr/export", response_model=GdprExportResponse)
async def gdpr_export(
    body: GdprSubjectRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_tenant_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    actor_id: Annotated[UUID, Depends(get_current_user_id)],
    _: Annotated[None, Depends(require_roles(*_GDPR_WRITE_ROLES))],
):
    package = await GdprService(db).export_subject(
        tenant_id=tenant_id,
        subject_email=body.subject_email,
    )
    await AuditService(db).record(
        tenant_id=tenant_id,
        actor_id=actor_id,
        actor_email=await _actor_email(db, actor_id),
        action=AuditAction.EXPORT,
        resource_type="data_subject",
        resource_id=body.subject_email.strip().lower(),
        ip_address=await get_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
        after_state={"counts": package.get("counts")},
        detail="GDPR Article 15 data export",
    )
    return GdprExportResponse(**package)


@router.post("/gdpr/erase", response_model=GdprEraseResponse)
async def gdpr_erase(
    body: GdprSubjectRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_tenant_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    actor_id: Annotated[UUID, Depends(get_current_user_id)],
    _: Annotated[None, Depends(require_roles(*_GDPR_WRITE_ROLES))],
):
    try:
        result = await GdprService(db).erase_subject(
            tenant_id=tenant_id,
            subject_email=body.subject_email,
            actor_id=actor_id,
            actor_email=await _actor_email(db, actor_id),
            ip_address=await get_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return GdprEraseResponse(**result)
