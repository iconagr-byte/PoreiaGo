"""Tenant white-label settings — syncs Postgres tenants + optional file branding store."""

from __future__ import annotations

import json
import logging
import re
from typing import Any
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditAction
from app.models.tenant import Tenant
from app.services.audit_service import AuditService
from olympus.config import get_olympus_settings

logger = logging.getLogger(__name__)

_DOMAIN_RE = re.compile(
    r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$",
    re.IGNORECASE,
)


def normalize_custom_domain(value: str | None) -> str | None:
    if not value:
        return None
    host = value.strip().lower().removeprefix("https://").removeprefix("http://")
    host = host.split("/")[0].split(":")[0].removeprefix("www.")
    return host or None


def _parse_settings_json(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def _branding_from_settings(settings: dict[str, Any]) -> dict[str, Any]:
    branding = settings.get("branding")
    return branding if isinstance(branding, dict) else {}


class TenantBrandingService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._audit = AuditService(session)
        self._olympus = get_olympus_settings()

    async def get_settings(
        self,
        tenant_id: UUID,
        tenant_slug: str | None = None,
    ) -> dict[str, Any]:
        tenant = await self._resolve_tenant(tenant_id, tenant_slug)
        if not tenant:
            return self._settings_from_file(tenant_slug or "achillio")

        settings = _parse_settings_json(tenant.settings_json)
        branding = _branding_from_settings(settings)
        theme = settings.get("theme") if isinstance(settings.get("theme"), dict) else {}
        theme_cfg = tenant.theme_config if isinstance(tenant.theme_config, dict) else {}

        primary = (
            theme_cfg.get("primary")
            or theme.get("primary")
            or branding.get("primary_color")
            or "#0040df"
        )
        base_domain = self._olympus["base_domain"]
        custom_domain = tenant.custom_domain
        subdomain_fqdn = f"{tenant.subdomain}.{base_domain}"

        return {
            "display_name": tenant.legal_name,
            "slug": tenant.slug,
            "subdomain": tenant.subdomain,
            "platform_domain": base_domain,
            "subdomain_fqdn": subdomain_fqdn,
            "custom_domain": custom_domain or "",
            "primary_color": primary,
            "logo_url": theme_cfg.get("logoUrl") or branding.get("logo_url") or "",
            "css_injection_url": branding.get("css_injection_url") or "",
            "css_injection_inline": branding.get("css_injection_inline") or "",
            "checkout_base_url": branding.get("checkout_base_url") or f"https://{subdomain_fqdn}",
            "dns_instructions": self._dns_instructions(custom_domain, subdomain_fqdn),
        }

    async def update_settings(
        self,
        tenant_id: UUID,
        *,
        tenant_slug: str | None = None,
        display_name: str | None = None,
        custom_domain: str | None = None,
        primary_color: str | None = None,
        logo_url: str | None = None,
        css_injection_url: str | None = None,
        css_injection_inline: str | None = None,
        checkout_base_url: str | None = None,
        actor_email: str | None = None,
    ) -> dict[str, Any]:
        tenant = await self._resolve_tenant(tenant_id, tenant_slug)
        if not tenant:
            raise ValueError(
                "Tenant not found in Postgres — εκτελέστε python -m scripts.seed_saas_dev και ξανασυνδεθείτε",
            )

        before_domain = tenant.custom_domain

        if custom_domain is not None:
            normalized = normalize_custom_domain(custom_domain)
            if normalized and not _DOMAIN_RE.match(normalized):
                raise ValueError("Invalid custom domain format (example: travel.agency.gr)")
            await self._ensure_domain_available(normalized, tenant_id)
            tenant.custom_domain = normalized

        if display_name is not None and display_name.strip():
            tenant.legal_name = display_name.strip()

        settings = _parse_settings_json(tenant.settings_json)
        branding = _branding_from_settings(settings)
        theme = settings.get("theme") if isinstance(settings.get("theme"), dict) else {}

        if primary_color is not None:
            theme["primary"] = primary_color
            theme_cfg = dict(tenant.theme_config or {})
            theme_cfg["primary"] = primary_color
            tenant.theme_config = theme_cfg

        if logo_url is not None:
            branding["logo_url"] = logo_url
            theme_cfg = dict(tenant.theme_config or {})
            theme_cfg["logoUrl"] = logo_url or None
            tenant.theme_config = theme_cfg

        if css_injection_url is not None:
            branding["css_injection_url"] = css_injection_url
        if css_injection_inline is not None:
            if len(css_injection_inline) > 50_000:
                raise ValueError("CSS injection exceeds 50KB limit")
            branding["css_injection_inline"] = css_injection_inline
        if checkout_base_url is not None:
            branding["checkout_base_url"] = checkout_base_url.strip()

        settings["theme"] = theme
        settings["branding"] = branding
        tenant.settings_json = json.dumps(settings, ensure_ascii=False)

        await self._session.flush()
        await self._sync_file_branding(tenant.slug, tenant, branding, theme)
        await self._audit.record(
            tenant_id=tenant_id,
            actor_id=None,
            actor_email=actor_email or "tenant_admin",
            action=AuditAction.UPDATE,
            resource_type="tenant_branding",
            resource_id=str(tenant_id),
            detail="Updated white-label domain/branding",
            before_state={"custom_domain": before_domain},
            after_state={"custom_domain": tenant.custom_domain},
        )
        return await self.get_settings(tenant_id, tenant_slug)

    async def _resolve_tenant(
        self,
        tenant_id: UUID,
        tenant_slug: str | None = None,
    ) -> Tenant | None:
        result = await self._session.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()
        if tenant:
            return tenant
        slug = (tenant_slug or "").strip().lower()
        if slug:
            by_slug = await self._session.execute(select(Tenant).where(Tenant.slug == slug).limit(1))
            return by_slug.scalar_one_or_none()
        return None

    def _settings_from_file(self, slug: str) -> dict[str, Any]:
        try:
            from travel_platform.growth.branding_store import get_branding

            row = get_branding(slug)
            base_domain = self._olympus["base_domain"]
            subdomain = row.slug or slug
            custom_domain = row.custom_domain or ""
            return {
                "display_name": row.display_name,
                "slug": subdomain,
                "subdomain": subdomain,
                "platform_domain": base_domain,
                "subdomain_fqdn": f"{subdomain}.{base_domain}",
                "custom_domain": custom_domain,
                "primary_color": row.primary_color or "#0040df",
                "logo_url": row.logo_url or "",
                "css_injection_url": row.css_injection_url or "",
                "css_injection_inline": row.css_injection_inline or "",
                "checkout_base_url": row.checkout_base_url or f"http://localhost:5173",
                "dns_instructions": self._dns_instructions(
                    custom_domain or None,
                    f"{subdomain}.{base_domain}",
                ),
            }
        except Exception:
            base_domain = self._olympus["base_domain"]
            subdomain = slug or "achillio"
            return {
                "display_name": "Demo Travel",
                "slug": subdomain,
                "subdomain": subdomain,
                "platform_domain": base_domain,
                "subdomain_fqdn": f"{subdomain}.{base_domain}",
                "custom_domain": "",
                "primary_color": "#0040df",
                "logo_url": "",
                "css_injection_url": "",
                "css_injection_inline": "",
                "checkout_base_url": "http://localhost:5173",
                "dns_instructions": self._dns_instructions(None, f"{subdomain}.{base_domain}"),
            }

    async def _load_tenant(self, tenant_id: UUID) -> Tenant:
        tenant = await self._resolve_tenant(tenant_id)
        if not tenant:
            raise ValueError("Tenant not found")
        return tenant

    async def _ensure_domain_available(self, domain: str | None, tenant_id: UUID) -> None:
        if not domain:
            return
        result = await self._session.execute(
            select(Tenant.id).where(
                Tenant.id != tenant_id,
                or_(
                    Tenant.custom_domain == domain,
                    Tenant.custom_domain == f"www.{domain}",
                ),
            ).limit(1),
        )
        if result.scalar_one_or_none():
            raise ValueError("This custom domain is already registered to another tenant")

    def _dns_instructions(
        self,
        custom_domain: str | None,
        subdomain_fqdn: str,
    ) -> dict[str, Any]:
        ingress = self._olympus.get("ingress_cname", "ingress.olympus-saas.com")
        base_domain = self._olympus["base_domain"]
        notes = [
            f"Το subdomain {subdomain_fqdn} λειτουργεί αυτόματα (wildcard SSL).",
            "Για δικό σας domain, προσθέστε CNAME στον DNS provider σας.",
            "Μετά την αποθήκευση, το Traefik ζητά έλεγχο από /api/v1/platform/tls/validate-domain πριν εκδώσει πιστοποιητικό.",
        ]
        if not custom_domain:
            return {
                "cname_host": custom_domain or "your-domain.example",
                "cname_target": ingress,
                "subdomain_cname_host": subdomain_fqdn.split(".")[0],
                "subdomain_cname_target": base_domain,
                "notes": notes,
            }
        return {
            "cname_host": custom_domain,
            "cname_target": ingress,
            "alternate_www_host": f"www.{custom_domain}",
            "subdomain_cname_host": subdomain_fqdn,
            "subdomain_cname_target": base_domain,
            "notes": notes,
        }

    def _sync_file_branding(
        self,
        slug: str,
        tenant: Tenant,
        branding: dict[str, Any],
        theme: dict[str, Any],
    ) -> None:
        try:
            from travel_platform.growth.branding_store import update_branding

            payload = {
                "slug": tenant.slug,
                "display_name": tenant.legal_name,
                "custom_domain": tenant.custom_domain or "",
                "primary_color": theme.get("primary") or branding.get("primary_color") or "#0040df",
                "logo_url": branding.get("logo_url") or "",
                "css_injection_url": branding.get("css_injection_url") or "",
                "css_injection_inline": branding.get("css_injection_inline") or "",
                "checkout_base_url": branding.get("checkout_base_url") or "",
                "verified_domain": bool(tenant.custom_domain),
            }
            update_branding("default", payload)
            if slug != "default":
                update_branding(slug, payload)
        except Exception:
            logger.debug("File branding sync skipped for %s", slug, exc_info=True)


def is_db_unavailable(exc: BaseException) -> bool:
    from sqlalchemy.exc import DBAPIError, OperationalError

    if isinstance(exc, (OperationalError, DBAPIError, OSError, ConnectionRefusedError)):
        return True
    cause = getattr(exc, "__cause__", None)
    return isinstance(cause, (ConnectionRefusedError, OSError))


def _file_branding_service() -> TenantBrandingService:
    svc = TenantBrandingService.__new__(TenantBrandingService)
    svc._session = None  # type: ignore[assignment]
    svc._audit = None  # type: ignore[assignment]
    svc._olympus = get_olympus_settings()
    return svc


def get_file_branding_settings(slug: str = "achillio") -> dict[str, Any]:
    return _file_branding_service()._settings_from_file(slug)


def update_file_branding_settings(slug: str, patch: dict[str, Any]) -> dict[str, Any]:
    from travel_platform.growth.branding_store import update_branding

    allowed = {
        "display_name",
        "slug",
        "custom_domain",
        "primary_color",
        "logo_url",
        "css_injection_url",
        "css_injection_inline",
        "checkout_base_url",
    }
    clean = {k: v for k, v in patch.items() if k in allowed}
    if clean.get("custom_domain") == "":
        clean["verified_domain"] = False
    elif clean.get("custom_domain"):
        clean["verified_domain"] = True
    update_branding("default", clean)
    if slug != "default":
        update_branding(slug, clean)
    return get_file_branding_settings(slug)
