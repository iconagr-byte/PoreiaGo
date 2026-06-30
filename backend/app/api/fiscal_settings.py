"""Tenant fiscal provider settings API."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import TenantFiscalSettingsResponse, TenantFiscalSettingsUpdate
from app.core.auth_deps import get_current_tenant_id, get_platform_db, require_roles
from app.models.user import UserRole
from app.services.tenant_fiscal_settings_service import TenantFiscalSettingsService

router = APIRouter(prefix="/settings", tags=["Tenant Settings"])


@router.get("/fiscal", response_model=TenantFiscalSettingsResponse)
async def get_fiscal_settings(
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    _: Annotated[None, Depends(require_roles(UserRole.TENANT_ADMIN, UserRole.SUPERADMIN))],
):
    try:
        return await TenantFiscalSettingsService(db).get_settings(tenant_id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/fiscal", response_model=TenantFiscalSettingsResponse)
async def update_fiscal_settings(
    body: TenantFiscalSettingsUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    _: Annotated[None, Depends(require_roles(UserRole.TENANT_ADMIN, UserRole.SUPERADMIN))],
):
    actor_email = request.headers.get("X-Actor-Email")
    try:
        return await TenantFiscalSettingsService(db).update_settings(
            tenant_id,
            body.model_dump(exclude_unset=True),
            actor_email=actor_email,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
