"""Traefik on-demand TLS domain validation."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession

from olympus.tenant.domain_resolver import DomainResolver

router = APIRouter(prefix="/tls", tags=["platform-tls"])


class TlsValidateResponse(BaseModel):
    allowed: bool
    domain: str


@router.get("/validate-domain", response_model=TlsValidateResponse)
async def validate_domain_for_tls(
    domain: str = Query(..., min_length=3),
    session: AsyncSession = Depends(get_db),
):
    """
    Traefik onDemand TLS ask endpoint.
    Returns 200 with allowed=true only if domain is mapped in tenants.custom_domain.
    """
    resolver = DomainResolver(session)
    allowed = await resolver.is_custom_domain_allowed(domain)
    return TlsValidateResponse(allowed=allowed, domain=domain)
