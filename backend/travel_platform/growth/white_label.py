"""
White-label — custom domains, theme tokens, optional CSS injection per tenant.
Traefik routes Host(custom_domain) → same frontend; API resolves tenant by domain mapping.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.base_service import TenantScopedService


@dataclass(frozen=True)
class TenantBranding:
    tenant_id: UUID
    slug: str
    display_name: str
    logo_url: str | None
    primary_color: str
    custom_domain: str | None
    css_injection_url: str | None
    css_injection_inline: str | None
    verified_domain: bool
    updated_at: datetime | None


class WhiteLabelService(TenantScopedService):
    """CRUD for tenant branding; domain verification is async (DNS TXT / HTTP)."""

    async def get_branding(self) -> TenantBranding | None:
        await self._bind_tenant_rls()
        r = await self._session.execute(
            text("""
                SELECT tenant_id, slug, display_name, logo_url, primary_color,
                       custom_domain, css_injection_url, css_injection_inline,
                       verified_domain, updated_at
                FROM tenant_branding
                WHERE tenant_id = :tenant
            """),
            {"tenant": str(self._tenant_id)},
        )
        row = r.mappings().first()
        if not row:
            return None
        return TenantBranding(
            tenant_id=UUID(str(row["tenant_id"])),
            slug=row["slug"],
            display_name=row["display_name"],
            logo_url=row["logo_url"],
            primary_color=row["primary_color"] or "#0040df",
            custom_domain=row["custom_domain"],
            css_injection_url=row["css_injection_url"],
            css_injection_inline=row["css_injection_inline"],
            verified_domain=bool(row["verified_domain"]),
            updated_at=row["updated_at"],
        )

    async def upsert_branding(
        self,
        *,
        display_name: str,
        slug: str,
        logo_url: str | None = None,
        primary_color: str = "#0040df",
        custom_domain: str | None = None,
        css_injection_url: str | None = None,
        css_injection_inline: str | None = None,
    ) -> TenantBranding:
        await self._bind_tenant_rls()
        if css_injection_inline and len(css_injection_inline) > 50_000:
            from core.exceptions import PlatformError

            raise PlatformError("CSS injection exceeds 50KB limit")

        await self._session.execute(
            text("""
                INSERT INTO tenant_branding (
                    tenant_id, slug, display_name, logo_url, primary_color,
                    custom_domain, css_injection_url, css_injection_inline,
                    verified_domain, updated_at
                )
                VALUES (
                    :tenant, :slug, :name, :logo, :color,
                    :domain, :css_url, :css_inline,
                    false, NOW()
                )
                ON CONFLICT (tenant_id) DO UPDATE SET
                    slug = EXCLUDED.slug,
                    display_name = EXCLUDED.display_name,
                    logo_url = EXCLUDED.logo_url,
                    primary_color = EXCLUDED.primary_color,
                    custom_domain = EXCLUDED.custom_domain,
                    css_injection_url = EXCLUDED.css_injection_url,
                    css_injection_inline = EXCLUDED.css_injection_inline,
                    verified_domain = CASE
                        WHEN tenant_branding.custom_domain IS DISTINCT FROM EXCLUDED.custom_domain
                        THEN false ELSE tenant_branding.verified_domain END,
                    updated_at = NOW()
            """),
            {
                "tenant": str(self._tenant_id),
                "slug": slug,
                "name": display_name,
                "logo": logo_url,
                "color": primary_color,
                "domain": custom_domain,
                "css_url": css_injection_url,
                "css_inline": css_injection_inline,
            },
        )
        await self._audit(
            "growth.branding_updated",
            "tenant_branding",
            str(self._tenant_id),
            metadata={"custom_domain": custom_domain},
        )
        branding = await self.get_branding()
        assert branding is not None
        return branding

    async def resolve_tenant_by_host(self, host: str) -> UUID | None:
        """Public resolver for middleware — no tenant context yet."""
        r = await self._session.execute(
            text("""
                SELECT tenant_id FROM tenant_branding
                WHERE custom_domain = :host AND verified_domain = true
            """),
            {"host": host.lower().removeprefix("www.")},
        )
        row = r.mappings().first()
        return UUID(str(row["tenant_id"])) if row else None
