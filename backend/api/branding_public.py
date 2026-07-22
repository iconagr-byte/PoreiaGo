"""Public branding resolver — no JWT."""

from __future__ import annotations

from fastapi import APIRouter, Query

from travel_platform.growth.branding_store import get_branding, resolve_by_host
from schemas.platform_admin import BrandingAdminResponse

router = APIRouter(prefix="/api/branding", tags=["branding"])


@router.get("/current", response_model=BrandingAdminResponse)
async def get_current_branding(host: str | None = Query(default=None)):
    # Prefer Postgres tenant when Host maps to an office (custom domain / subdomain).
    if host:
        try:
            from app.core.database import AsyncSessionLocal
            from olympus.tenant.domain_resolver import DomainResolver

            async with AsyncSessionLocal() as session:
                resolved = await DomainResolver(session).resolve(host)
                if resolved:
                    from sqlalchemy import select
                    from app.models.tenant import Tenant

                    row = await session.execute(select(Tenant).where(Tenant.id == resolved.tenant_id))
                    tenant = row.scalar_one_or_none()
                    theme = resolved.theme or {}
                    display = (
                        (tenant.legal_name if tenant else None)
                        or theme.get("displayName")
                        or theme.get("display_name")
                        or resolved.slug
                    )
                    return BrandingAdminResponse(
                        slug=resolved.slug,
                        display_name=display,
                        logo_url=theme.get("logoUrl") or theme.get("logo_url") or "",
                        primary_color=theme.get("primary") or "#0040df",
                        custom_domain=resolved.custom_domain or "",
                        css_injection_url="",
                        css_injection_inline="",
                        verified_domain=True,
                        checkout_base_url="",
                    )
        except Exception:
            pass

    branding = resolve_by_host(host) if host else get_branding("default")
    return BrandingAdminResponse(**branding.to_dict())
