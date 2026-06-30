"""Tenant homepage appearance — stored in tenants.settings_json.site_appearance."""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditAction
from app.models.tenant import Tenant
from app.services.audit_service import AuditService

DEFAULT_SITE_APPEARANCE: dict[str, Any] = {
    "logo_url": "",
    "hero_image_url": "/images/hero-bus-achillio.png",
    "hero_badge": "Premium Ταξιδιωτική Εμπειρία",
    "hero_title": "Η Ελλάδα, όπως δεν την έχεις ξαναδεί:",
    "hero_title_accent": "Άνεση, ασφάλεια & θέση εξασφαλισμένη.",
    "hero_subtitle": (
        "Διάλεξτε από τις προγραμματισμένες εκδρομές μας — χωρίς αναζήτηση προορισμού, "
        "μόνο ταξίδια που οργανώνουμε εμείς."
    ),
    "hero_search_label": "Πρόγραμμα εκδρομών",
    "footer_brand_name": "PoreiaGo",
    "footer_copyright": "© PoreiaGo. Redefining the journey.",
    "homepage_theme_id": "aegean_classic",
    "accent_color": "#0ea5e9",
    "show_fleet_section": True,
    "show_why_us_section": True,
}


def _parse_settings(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


class TenantSiteAppearanceService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._audit = AuditService(session)

    async def get_appearance(self, tenant_id: UUID) -> dict[str, Any]:
        tenant = await self._get_tenant(tenant_id)
        settings = _parse_settings(tenant.settings_json)
        stored = settings.get("site_appearance")
        merged = {**DEFAULT_SITE_APPEARANCE, **(stored if isinstance(stored, dict) else {})}
        merged["storage_source"] = "postgres"
        merged["tenant_slug"] = tenant.slug
        return merged

    async def update_appearance(
        self,
        tenant_id: UUID,
        patch: dict[str, Any],
        *,
        actor_email: str | None = None,
    ) -> dict[str, Any]:
        tenant = await self._get_tenant(tenant_id)
        settings = _parse_settings(tenant.settings_json)
        current = settings.get("site_appearance")
        base = current if isinstance(current, dict) else {}
        updated = {**DEFAULT_SITE_APPEARANCE, **base, **patch}
        settings["site_appearance"] = updated
        tenant.settings_json = json.dumps(settings, ensure_ascii=False)
        await self._session.flush()
        await self._audit.record(
            tenant_id=tenant_id,
            actor_id=None,
            actor_email=actor_email or "tenant_admin",
            action=AuditAction.UPDATE,
            resource_type="site_appearance",
            resource_id=str(tenant_id),
            detail="Updated homepage appearance",
        )
        result = await self.get_appearance(tenant_id)
        return result

    async def _get_tenant(self, tenant_id: UUID) -> Tenant:
        result = await self._session.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise ValueError("Tenant not found")
        return tenant
