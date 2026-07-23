"""Tenant homepage appearance — stored in tenants.settings_json.site_appearance."""

from __future__ import annotations

import json
import re
from datetime import datetime
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
    "footer_brand_name": "",
    "footer_copyright": "",
    "footer_privacy_label": "Πολιτική Απορρήτου",
    "footer_privacy_url": "#",
    "footer_terms_label": "Όροι Χρήσης",
    "footer_terms_url": "#",
    "footer_contact_email": "",
    "footer_contact_phone": "",
    "footer_address": "",
    "homepage_theme_id": "aegean_classic",
    "accent_color": "#0ea5e9",
    "show_fleet_section": True,
    "show_why_us_section": True,
}

_PLATFORM_BRAND_RE = re.compile(r"^(aerostride|poreiago)$", re.I)
_PLATFORM_COPY_RE = re.compile(r"aerostride|poreiago", re.I)
_PLATFORM_LOGO_RE = re.compile(r"/api/site/assets/logo|poreiago|aerostride", re.I)


def _parse_settings(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def _is_platform_logo(url: str | None) -> bool:
    value = str(url or "").strip()
    if not value:
        return True
    return bool(_PLATFORM_LOGO_RE.search(value))


def _scrub_platform_placeholders(data: dict[str, Any]) -> dict[str, Any]:
    out = {**data}
    brand = str(out.get("footer_brand_name") or "").strip()
    if not brand or _PLATFORM_BRAND_RE.match(brand):
        out["footer_brand_name"] = ""
    copyright_text = str(out.get("footer_copyright") or "").strip()
    if not copyright_text or _PLATFORM_COPY_RE.search(copyright_text):
        out["footer_copyright"] = ""
    if _is_platform_logo(out.get("logo_url")):
        out["logo_url"] = ""
    return out


def _enrich_from_tenant(data: dict[str, Any], tenant: Tenant, settings: dict[str, Any]) -> dict[str, Any]:
    """Fill empty brand/logo from office legal name + branding settings."""
    out = {**data}
    branding = settings.get("branding") if isinstance(settings.get("branding"), dict) else {}
    theme_cfg = tenant.theme_config if isinstance(tenant.theme_config, dict) else {}
    office_name = (tenant.legal_name or tenant.slug or "").strip()
    branding_logo = str(theme_cfg.get("logoUrl") or branding.get("logo_url") or "").strip()
    if _is_platform_logo(branding_logo):
        branding_logo = ""

    current_logo = str(out.get("logo_url") or "").strip()
    if _is_platform_logo(current_logo):
        out["logo_url"] = ""
        current_logo = ""

    if not current_logo and branding_logo:
        out["logo_url"] = branding_logo

    if not str(out.get("footer_brand_name") or "").strip() and office_name:
        out["footer_brand_name"] = office_name

    if not str(out.get("footer_copyright") or "").strip() and office_name:
        out["footer_copyright"] = f"© {datetime.utcnow().year} {office_name}"

    out["display_name"] = office_name
    return out


class TenantSiteAppearanceService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._audit = AuditService(session)

    async def get_appearance(self, tenant_id: UUID) -> dict[str, Any]:
        tenant = await self._get_tenant(tenant_id)
        settings = _parse_settings(tenant.settings_json)
        stored = settings.get("site_appearance")
        merged = {**DEFAULT_SITE_APPEARANCE, **(stored if isinstance(stored, dict) else {})}
        merged = _scrub_platform_placeholders(merged)
        merged = _enrich_from_tenant(merged, tenant, settings)
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
        updated = _scrub_platform_placeholders({**DEFAULT_SITE_APPEARANCE, **base, **patch})
        # Persist only appearance keys — drop enrichment helpers.
        updated.pop("display_name", None)
        updated.pop("storage_source", None)
        updated.pop("tenant_slug", None)
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
