from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from core.dependencies import get_actor_id, get_audit_service, get_tenant_db, get_tenant_id
from travel_platform.compliance.audit_trail import AuditTrailService
from travel_platform.growth.white_label import WhiteLabelService
from schemas.platform.growth import BrandingResponse, BrandingUpdateRequest
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.get("/branding", response_model=BrandingResponse)
async def get_branding(
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
):
    svc = WhiteLabelService(session, tenant_id)
    branding = await svc.get_branding()
    if not branding:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Branding not configured")
    return BrandingResponse(
        slug=branding.slug,
        display_name=branding.display_name,
        logo_url=branding.logo_url,
        primary_color=branding.primary_color,
        custom_domain=branding.custom_domain,
        css_injection_url=branding.css_injection_url,
        verified_domain=branding.verified_domain,
    )


@router.put("/branding", response_model=BrandingResponse)
async def update_branding(
    body: BrandingUpdateRequest,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
    audit: Annotated[AuditTrailService, Depends(get_audit_service)],
):
    svc = WhiteLabelService(session, tenant_id, audit=audit, actor_id=actor_id)
    branding = await svc.upsert_branding(
        display_name=body.display_name,
        slug=body.slug,
        logo_url=str(body.logo_url) if body.logo_url else None,
        primary_color=body.primary_color,
        custom_domain=body.custom_domain,
        css_injection_url=str(body.css_injection_url) if body.css_injection_url else None,
        css_injection_inline=body.css_injection_inline,
    )
    return BrandingResponse(
        slug=branding.slug,
        display_name=branding.display_name,
        logo_url=branding.logo_url,
        primary_color=branding.primary_color,
        custom_domain=branding.custom_domain,
        css_injection_url=branding.css_injection_url,
        verified_domain=branding.verified_domain,
    )
