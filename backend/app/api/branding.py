"""Tenant white-label branding — Postgres tenants.custom_domain + theme."""

from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
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
from app.services.tenant_office_asset_service import clear_office_asset, save_office_asset
from app.services.tenant_site_appearance_service import (
    DEFAULT_SITE_APPEARANCE,
    TenantSiteAppearanceService,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/branding", tags=["Tenant Branding"])

_ASSET_KINDS = frozenset({"logo", "hero"})


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
    except Exception as exc:
        logger.exception("Site appearance GET failed")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load appearance") from exc
    try:
        return TenantSiteAppearanceResponse(**data)
    except Exception as exc:
        logger.exception("Site appearance response validation failed")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invalid appearance data") from exc


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
    # Never persist multi-hundred-KB data URLs in Postgres settings_json —
    # they blow up the row and cause 500s. Clients must use the upload endpoint.
    for key in ("logo_url", "hero_image_url"):
        val = patch.get(key)
        if isinstance(val, str) and val.startswith("data:") and len(val) > 8_000:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="Χρησιμοποιήστε Ανέβασμα αρχείου για λογότυπο/hero (όχι data URL)",
            )
    try:
        data = await TenantSiteAppearanceService(db).update_appearance(
            tenant_id,
            patch,
            actor_email=actor_email,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Site appearance PUT failed for tenant %s", tenant_id)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Αποτυχία αποθήκευσης εμφάνισης",
        ) from exc
    try:
        return TenantSiteAppearanceResponse(**data)
    except Exception as exc:
        logger.exception("Site appearance response validation failed after update")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invalid appearance data") from exc


@router.post("/site-appearance/upload/{kind}")
async def upload_site_appearance_asset(
    kind: str,
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    _: Annotated[None, Depends(require_roles(UserRole.TENANT_ADMIN, UserRole.SUPERADMIN))],
    file: UploadFile = File(...),
):
    """Store logo/hero on disk and persist a short URL in tenant site_appearance."""
    kind_norm = str(kind or "").strip().lower()
    if kind_norm not in _ASSET_KINDS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid asset kind")
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Επιτρέπονται μόνο εικόνες (JPG, PNG, WebP)",
        )
    content = await file.read()
    try:
        saved = save_office_asset(
            tenant_id,
            kind_norm,
            content=content,
            filename=file.filename,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Office asset optimize/save failed")
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Αποτυχία επεξεργασίας εικόνας",
        ) from exc

    key = "logo_url" if kind_norm == "logo" else "hero_image_url"
    try:
        appearance = await TenantSiteAppearanceService(db).update_appearance(
            tenant_id,
            {key: saved["url"]},
            actor_email=None,
        )
    except Exception as exc:
        logger.exception("Failed to persist office asset URL")
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Αποτυχία αποθήκευσης URL",
        ) from exc

    return {
        "ok": True,
        "kind": kind_norm,
        "url": saved["url"],
        "bytes": saved["bytes"],
        "content_type": saved["content_type"],
        "appearance": appearance,
    }


@router.delete("/site-appearance/upload/{kind}")
async def clear_site_appearance_asset(
    kind: str,
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    _: Annotated[None, Depends(require_roles(UserRole.TENANT_ADMIN, UserRole.SUPERADMIN))],
):
    kind_norm = str(kind or "").strip().lower()
    if kind_norm not in _ASSET_KINDS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid asset kind")
    try:
        clear_office_asset(tenant_id, kind_norm)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    key = "logo_url" if kind_norm == "logo" else "hero_image_url"
    value = "" if kind_norm == "logo" else DEFAULT_SITE_APPEARANCE.get("hero_image_url", "")
    appearance = await TenantSiteAppearanceService(db).update_appearance(
        tenant_id,
        {key: value},
    )
    return {"ok": True, "appearance": appearance}
