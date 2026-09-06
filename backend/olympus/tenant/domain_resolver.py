"""Resolve tenant + white-label theme from HTTP Host header."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from olympus.config import get_olympus_settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ResolvedTenant:
    tenant_id: UUID
    slug: str
    subdomain: str
    custom_domain: str | None
    theme: dict[str, Any]
    is_active: bool
    admin_ip_whitelist: list[str] | None = None


DEFAULT_THEME: dict[str, Any] = {
    "primary": "#005d90",
    "accent": "#0077b6",
    "fontFamily": "Inter, sans-serif",
    "logoUrl": None,
    "faviconUrl": None,
}


def normalize_host(host: str | None) -> str:
    if not host:
        return ""
    return host.split(":")[0].strip().lower().rstrip(".")


def parse_theme(settings_json: str | None, theme_config: dict | None) -> dict[str, Any]:
    theme = dict(DEFAULT_THEME)
    if theme_config:
        theme.update(theme_config)
    if settings_json:
        try:
            parsed = json.loads(settings_json)
            if isinstance(parsed.get("theme"), dict):
                theme.update(parsed["theme"])
            elif isinstance(parsed, dict):
                for key in ("primary", "accent", "logoUrl", "fontFamily"):
                    if key in parsed:
                        theme[key] = parsed[key]
        except json.JSONDecodeError:
            pass
    return theme


def _tenant_to_resolved(tenant: Tenant) -> ResolvedTenant:
    theme_cfg = getattr(tenant, "theme_config", None)
    whitelist = getattr(tenant, "admin_ip_whitelist", None)
    return ResolvedTenant(
        tenant_id=tenant.id,
        slug=tenant.slug,
        subdomain=tenant.subdomain,
        custom_domain=tenant.custom_domain,
        theme=parse_theme(tenant.settings_json, theme_cfg),
        is_active=tenant.is_active,
        admin_ip_whitelist=whitelist if isinstance(whitelist, list) else None,
    )


class DomainResolver:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._settings = get_olympus_settings()

    async def resolve(self, host: str | None) -> ResolvedTenant | None:
        normalized = normalize_host(host)
        if not normalized or normalized in ("localhost", "127.0.0.1"):
            return None

        base = self._settings["base_domain"].lower()
        subdomain: str | None = None
        if normalized.endswith(f".{base}"):
            subdomain = normalized[: -(len(base) + 1)]
            if subdomain in ("www", "api", "admin"):
                return None

        stmt = select(Tenant).where(Tenant.is_active.is_(True))
        if subdomain:
            stmt = stmt.where(Tenant.subdomain == subdomain)
        else:
            apex = normalized.removeprefix("www.")
            stmt = stmt.where(
                or_(
                    Tenant.custom_domain == normalized,
                    Tenant.custom_domain == apex,
                    Tenant.custom_domain == f"www.{apex}",
                ),
            )

        result = await self._session.execute(stmt.limit(1))
        tenant = result.scalar_one_or_none()
        if tenant:
            return _tenant_to_resolved(tenant)

        # File branding often has custom_domain before Postgres is updated —
        # map Host → branding slug/subdomain → tenants row, then backfill DB.
        if not subdomain:
            tenant = await self._resolve_via_file_branding(normalized)
            if tenant:
                return _tenant_to_resolved(tenant)
        return None

    async def _resolve_via_file_branding(self, normalized_host: str) -> Tenant | None:
        try:
            from travel_platform.growth.branding_store import resolve_by_host
        except Exception:
            return None

        branding = resolve_by_host(normalized_host)
        if not branding:
            return None
        apex = normalized_host.removeprefix("www.")
        brand_domain = (branding.custom_domain or "").lower().removeprefix("www.")
        if not brand_domain or brand_domain != apex:
            return None
        if not branding.verified_domain:
            return None

        slug = (branding.slug or "").strip()
        if not slug or slug in ("poreiago", "default"):
            return None

        result = await self._session.execute(
            select(Tenant)
            .where(
                Tenant.is_active.is_(True),
                or_(Tenant.slug == slug, Tenant.subdomain == slug),
            )
            .limit(1)
        )
        tenant = result.scalar_one_or_none()
        if not tenant:
            return None

        # Heal Postgres so Traefik TLS validate + future resolves work without the file store.
        if not (tenant.custom_domain or "").strip():
            try:
                tenant.custom_domain = apex
                await self._session.commit()
                await self._session.refresh(tenant)
                logger.info(
                    "Backfilled tenants.custom_domain=%s for slug=%s from file branding",
                    apex,
                    slug,
                )
            except Exception as exc:
                await self._session.rollback()
                logger.warning("custom_domain backfill failed for %s: %s", slug, exc)
        return tenant

    async def is_custom_domain_allowed(self, domain: str) -> bool:
        """Traefik on-demand TLS ask endpoint — only issue cert for mapped domains."""
        normalized = normalize_host(domain)
        if not normalized:
            return False
        resolved = await self.resolve(normalized)
        return resolved is not None
