"""Tenant platform/checkout settings — Postgres per-tenant."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import TenantPlatformSettingsResponse, TenantPlatformSettingsUpdate
from app.core.auth_deps import get_current_tenant_id, get_platform_db, require_roles
from app.models.user import UserRole
from app.services.tenant_platform_settings_service import TenantPlatformSettingsService

router = APIRouter(prefix="/settings", tags=["Tenant Settings"])


@router.get("/platform", response_model=TenantPlatformSettingsResponse)
async def get_platform_settings(
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    _: Annotated[None, Depends(require_roles(UserRole.TENANT_ADMIN, UserRole.SUPERADMIN))],
):
    try:
        data = await TenantPlatformSettingsService(db).get_settings(tenant_id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return TenantPlatformSettingsResponse(**data)


@router.patch("/platform", response_model=TenantPlatformSettingsResponse)
async def patch_platform_settings(
    body: TenantPlatformSettingsUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    _: Annotated[None, Depends(require_roles(UserRole.TENANT_ADMIN, UserRole.SUPERADMIN))],
):
    actor_email = request.headers.get("X-Actor-Email")
    patch = body.model_dump(exclude_unset=True)
    try:
        data = await TenantPlatformSettingsService(db).update_settings(
            tenant_id,
            patch,
            actor_email=actor_email,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return TenantPlatformSettingsResponse(**data)
