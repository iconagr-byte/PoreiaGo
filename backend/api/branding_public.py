"""Public branding resolver — no JWT."""

from __future__ import annotations

from fastapi import APIRouter, Query

from travel_platform.growth.branding_store import get_branding, resolve_by_host
from schemas.platform_admin import BrandingAdminResponse

router = APIRouter(prefix="/api/branding", tags=["branding"])


@router.get("/current", response_model=BrandingAdminResponse)
async def get_current_branding(host: str | None = Query(default=None)):
    branding = resolve_by_host(host) if host else get_branding("default")
    return BrandingAdminResponse(**branding.to_dict())
