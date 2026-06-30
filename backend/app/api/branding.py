"""Tenant white-label branding — Postgres tenants.custom_domain + theme."""

from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import (
    TenantBrandingSettingsResponse,
    TenantBrandingSettingsUpdate,
    TenantSiteAppearanceResponse,
    TenantSiteAppearanceUpdate,
)
from app.core.auth_deps import get_current_tenant_id, get_platform_db, get_token_payload, require_roles
from app.core.config import get_settings
from app.models.user import UserRole
from app.services.tenant_branding_service import (
    TenantBrandingService,
    get_file_branding_settings,
    is_db_unavailable,
    update_file_branding_settings,
)
from app.services.tenant_site_appearance_service import TenantSiteAppearanceService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/branding", tags=["Tenant Branding"])


def _dev_fallback_enabled() -> bool:
    return get_settings().environment in ("development", "dev", "local")


def _tenant_slug(payload: dict, fallback: str = "achillio") -> str:
    raw = payload.get("tenant_slug")
    return str(raw).strip().lower() if raw else fallback


@router.get("/settings", response_model=TenantBrandingSettingsResponse)
async def get_branding_settings(
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    payload: Annotated[dict, Depends(get_token_payload)],
    _: Annotated[None, Depends(require_roles(UserRole.TENANT_ADMIN, UserRole.SUPERADMIN))],
):
    slug = _tenant_slug(payload)
    try:
        data = await TenantBrandingService(db).get_settings(
            tenant_id,
            tenant_slug=slug,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        if _dev_fallback_enabled() and is_db_unavailable(exc):
            logger.warning("Branding GET: Postgres unavailable, using file store (%s)", exc)
            data = get_file_branding_settings(slug)
        else:
            logger.exception("Branding GET failed")
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable") from exc
    return TenantBrandingSettingsResponse(**data)


@router.put("/settings", response_model=TenantBrandingSettingsResponse)
async def update_branding_settings(
    body: TenantBrandingSettingsUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    payload: Annotated[dict, Depends(get_token_payload)],
    _: Annotated[None, Depends(require_roles(UserRole.TENANT_ADMIN, UserRole.SUPERADMIN))],
):
    actor_email = request.headers.get("X-Actor-Email")
    slug = _tenant_slug(payload)
    patch = body.model_dump(exclude_unset=True)
    try:
        data = await TenantBrandingService(db).update_settings(
            tenant_id,
            tenant_slug=slug,
            display_name=body.display_name,
            custom_domain=body.custom_domain,
            primary_color=body.primary_color,
            logo_url=body.logo_url,
            css_injection_url=body.css_injection_url,
            css_injection_inline=body.css_injection_inline,
            checkout_base_url=body.checkout_base_url,
            actor_email=actor_email,
        )
    except ValueError as exc:
        detail = str(exc)
        if _dev_fallback_enabled() and ("Tenant not found" in detail or "Postgres" in detail):
            data = update_file_branding_settings(slug, patch)
        else:
            code = status.HTTP_409_CONFLICT if "already registered" in detail.lower() else status.HTTP_400_BAD_REQUEST
            raise HTTPException(code, detail=detail) from exc
    except Exception as exc:
        if _dev_fallback_enabled() and is_db_unavailable(exc):
            logger.warning("Branding PUT: Postgres unavailable, using file store (%s)", exc)
            data = update_file_branding_settings(slug, patch)
        else:
            logger.exception("Branding PUT failed")
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable") from exc
    return TenantBrandingSettingsResponse(**data)


@router.get("/site-appearance", response_model=TenantSiteAppearanceResponse)
async def get_site_appearance(
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    _: Annotated[None, Depends(require_roles(UserRole.TENANT_ADMIN, UserRole.SUPERADMIN))],
):
    try:
        data = await TenantSiteAppearanceService(db).get_appearance(tenant_id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return TenantSiteAppearanceResponse(**data)


@router.put("/site-appearance", response_model=TenantSiteAppearanceResponse)
async def update_site_appearance(
    body: TenantSiteAppearanceUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    _: Annotated[None, Depends(require_roles(UserRole.TENANT_ADMIN, UserRole.SUPERADMIN))],
):
    actor_email = request.headers.get("X-Actor-Email")
    patch = body.model_dump(exclude_unset=True)
    try:
        data = await TenantSiteAppearanceService(db).update_appearance(
            tenant_id,
            patch,
            actor_email=actor_email,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return TenantSiteAppearanceResponse(**data)
