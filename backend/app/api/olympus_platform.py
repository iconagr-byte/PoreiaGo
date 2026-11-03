"""Traefik on-demand TLS domain validation + live DNS check."""

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
    Traefik onDemand TLS ask endpoint.
    Returns 200 with allowed=true only if domain is mapped in tenants.custom_domain.
    """
    resolver = DomainResolver(session)
    allowed = await resolver.is_custom_domain_allowed(domain)
    return TlsValidateResponse(allowed=allowed, domain=domain)


@router.get("/dns-check", response_model=TlsDnsCheckResponse)
async def dns_check_custom_domain(
    domain: str = Query(..., min_length=3),
    session: AsyncSession = Depends(get_db),
):
    """
    Registry + live DNS (www CNAME / apex A) — SuperAdmin «Έλεγχος DNS».
    Same automation path as Achillio Travel for any office domain.
    """
    from travel_platform.growth.domain_dns import check_custom_domain_dns

    resolver = DomainResolver(session)
    allowed = await resolver.is_custom_domain_allowed(domain)
    dns = check_custom_domain_dns(domain)
    msg = dns.get("message") or ""
    if not allowed:
        msg = "Δεν είναι στο registry. Αποθήκευσε το domain και ξαναέλεγξε. " + msg
    elif dns.get("ready_for_tls"):
        msg = "Registry OK + DNS www έτοιμο για TLS. " + msg
    return TlsDnsCheckResponse(
        allowed=allowed,
        domain=dns.get("domain") or domain,
        www_ok=bool(dns.get("www_ok")),
        apex_ok=bool(dns.get("apex_ok")),
        ready_for_tls=bool(dns.get("ready_for_tls")),
        ingress_cname=str(dns.get("ingress_cname") or "www.poreiago.com"),
        ingress_ip=str(dns.get("ingress_ip") or "169.58.199.186"),
        message=msg.strip(),
        www=dns.get("www"),
        apex=dns.get("apex"),
    )
