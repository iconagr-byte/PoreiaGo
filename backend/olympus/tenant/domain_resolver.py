"""Resolve tenant + white-label theme from HTTP Host header."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from olympus.config import get_olympus_settings


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
        if not tenant:
            return None

        theme_cfg = getattr(tenant, "theme_config", None) or tenant.theme_config if hasattr(tenant, "theme_config") else None
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

    async def is_custom_domain_allowed(self, domain: str) -> bool:
        """Traefik on-demand TLS ask endpoint — only issue cert for mapped domains."""
        normalized = normalize_host(domain)
        if not normalized:
            return False
        result = await self._session.execute(
            select(Tenant.id).where(
                Tenant.is_active.is_(True),
                or_(
                    Tenant.custom_domain == normalized,
                    Tenant.custom_domain == f"www.{normalized}",
                ),
            ).limit(1),
        )
        return result.scalar_one_or_none() is not None
