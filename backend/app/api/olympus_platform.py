"""Traefik on-demand TLS domain validation + live DNS check."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_deps import require_superadmin
from app.core.database import get_db
from olympus.tenant.domain_resolver import DomainResolver

router = APIRouter(prefix="/tls", tags=["platform-tls"])


class TlsValidateResponse(BaseModel):
    allowed: bool
    domain: str


class TlsDnsCheckResponse(BaseModel):
    allowed: bool
    domain: str
    www_ok: bool = False
    apex_ok: bool = False
    ready_for_tls: bool = False
    ingress_cname: str = "www.poreiago.com"
    ingress_ip: str = "169.58.199.186"
    message: str = ""
    www: dict[str, object] | None = None
    apex: dict[str, object] | None = None


@router.get("/validate-domain", response_model=TlsValidateResponse)
async def validate_domain_for_tls(
    domain: str = Query(..., min_length=3),
    session: AsyncSession = Depends(get_db),
):
    """
    Traefik onDemand TLS ask endpoint (must stay public).
    Returns 200 with allowed=true only if domain is mapped in tenants.custom_domain.
    """
    resolver = DomainResolver(session)
    allowed = await resolver.is_custom_domain_allowed(domain)
    return TlsValidateResponse(allowed=allowed, domain=domain)


@router.get("/dns-check", response_model=TlsDnsCheckResponse)
async def dns_check_custom_domain(
    domain: str = Query(..., min_length=3, max_length=255),
    session: AsyncSession = Depends(get_db),
    _: Annotated[None, Depends(require_superadmin)] = None,
):
    """
    Registry + live DNS — SuperAdmin only (not a public DNS oracle).
    Traefik continues to use /validate-domain without auth.
    """
    from travel_platform.growth.domain_dns import check_custom_domain_dns
    from travel_platform.growth.domain_security import enforce_rate_limit, is_valid_public_domain, normalize_apex

    apex = normalize_apex(domain)
    if not apex or not is_valid_public_domain(apex):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid domain")
    if not enforce_rate_limit(f"sa-dns:{apex}", max_calls=30):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many DNS checks")

    resolver = DomainResolver(session)
    allowed = await resolver.is_custom_domain_allowed(apex)
    dns = check_custom_domain_dns(apex)
    msg = dns.get("message") or ""
    if not allowed:
        msg = "Δεν είναι στο registry. Αποθήκευσε το domain και ξαναέλεγξε. " + msg
    elif dns.get("ready_for_tls"):
        msg = "Registry OK + DNS www έτοιμο για TLS. " + msg
    return TlsDnsCheckResponse(
        allowed=allowed,
        domain=dns.get("domain") or apex,
        www_ok=bool(dns.get("www_ok")),
        apex_ok=bool(dns.get("apex_ok")),
        ready_for_tls=bool(dns.get("ready_for_tls")),
        ingress_cname=str(dns.get("ingress_cname") or "www.poreiago.com"),
        ingress_ip=str(dns.get("ingress_ip") or "169.58.199.186"),
        message=msg.strip(),
        www=dns.get("www"),
        apex=dns.get("apex"),
    )
