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
    "logo_height_px": 40,
    "logo_max_width_px": 180,
    "logo_show_name": True,
    "hero_image_url": "",
    "hero_image_focal": "center",
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
    "rent_office_name": "",
    "rent_hero_title": "Το όχημά σας, σε λίγα βήματα",
    "rent_hero_copy": "Κράτηση, ημερολόγιο και χάρτης παραλαβής — όλα σε μία σελίδα.",
    "rent_guest_hero_title": "Δες τον στόλο πριν κλείσεις",
    "rent_guest_hero_copy": "",
    "rent_cta_label": "Βρες όχημα",
    "rent_pickup_locations": [],
    "rent_coverage_options": [],
    "rent_included_defaults": [],
    "rent_upsell_coverage_id": "",
    "trip_extra_options": [],
    "rent_notify_email_enabled": True,
    "rent_notify_sms_enabled": True,
    "rent_notify_email_label": "Θέλω προσφορές στο email",
    "rent_notify_sms_label": "Θέλω ενημερώσεις SMS για την κράτηση",
    "rent_notify_email_default": False,
    "rent_notify_sms_default": False,
    "rent_notify_sms_template_confirmed": (
        "Κράτηση {ref} επιβεβαιώθηκε. Παραλαβή: {pickup} · {start}. {office}"
    ),
    "rent_notify_sms_template_status": "Κράτηση {ref}: νέα κατάσταση {status}. {office}",
    "rent_notify_email_subject": "Κράτηση {ref} — επιβεβαίωση",
    "rent_notify_email_body": (
        "Γεια σου {name},<br/><br/>Η κράτησή σου <strong>{ref}</strong> επιβεβαιώθηκε."
        "<br/>Παραλαβή: {pickup}<br/>Έναρξη: {start}<br/><br/>Ευχαριστούμε,<br/>{office}"
    ),
    "home_slider_enabled": False,
    "home_slider_autoplay": True,
    "home_slider_interval_sec": 5,
    "home_slider_options": {},
    "home_slider_slides": [],
    "rent_slider_enabled": False,
    "rent_slider_autoplay": True,
    "rent_slider_interval_sec": 5,
    "rent_slider_options": {},
    "rent_slider_slides": [],
    "homepage_theme_id": "aegean_classic",
    "accent_color": "#0ea5e9",
    "show_fleet_section": True,
    "show_why_us_section": True,
    "trips_layout_template": "grid_three",
    "trip_card_template": "premium",
    "rent_fleet_layout_template": "rent_grid_three",
    "rent_fleet_card_template": "rent_premium",
}

_PLATFORM_BRAND_RE = re.compile(r"^(aerostride|poreiago)$", re.I)
_PLATFORM_COPY_RE = re.compile(r"aerostride|poreiago", re.I)
# Only legacy PoreiaGo/AeroStride brand marks — uploaded logos use
# /api/site/assets/logo or data: URLs and must not be scrubbed.
_PLATFORM_LOGO_RE = re.compile(r"poreiago|aerostride", re.I)
_ACHILLIO_BRAND_RE = re.compile(r"achillio|achillion", re.I)
_OBSOLETE_RENT_GUEST_HERO_COPY = (
    "Περιήγηση οχημάτων χωρίς σύνδεση — για κράτηση χρειάζεται είσοδος."
)


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
    # Real tenant uploads — never treat as platform placeholder.
    if value.startswith("data:image/") or value.startswith("/api/site/assets/"):
        return False
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


def _looks_like_achillio_brand(value: str | None) -> bool:
    return bool(_ACHILLIO_BRAND_RE.search(str(value or "").strip()))


def _is_opaque_uploaded_logo(url: str | None) -> bool:
    """data:/assets logos have no Achillio keyword — still poison when brand drifted."""
    value = str(url or "").strip()
    if not value:
        return False
    return (
        value.startswith("data:image/")
        or value.startswith("/api/site/assets/")
        or "/uploads/site/" in value
        or value.startswith("uploads/site/")
    )


def _sanitize_poreiago_platform_appearance(
    data: dict[str, Any],
    tenant: Tenant,
) -> dict[str, Any]:
    """
    PoreiaGo platform / demo office must never surface Achillio Travel branding.

    Historic seed used slug=achillio; appearance/legal_name sometimes drifted to
    Achillio Travel and leaked onto www.poreiago.com + admin sidebar.
    """
    from app.services.tenant_modules import is_poreiago_platform_office

    if not is_poreiago_platform_office(tenant):
        return data

    out = {**data}
    office_name = "PoreiaGo"
    legal = str(getattr(tenant, "legal_name", None) or "").strip()
    legal_poisoned = _looks_like_achillio_brand(legal) or legal.lower() == "achillio"
    if legal and not legal_poisoned and "poreiago" in legal.lower():
        office_name = legal

    brand_keys = ("footer_brand_name", "rent_office_name", "display_name")
    brand_poisoned = any(_looks_like_achillio_brand(out.get(key)) for key in brand_keys)
    brand_poisoned = brand_poisoned or legal_poisoned

    for key in brand_keys:
        if _looks_like_achillio_brand(out.get(key)) or not str(out.get(key) or "").strip():
            out[key] = office_name

    if _looks_like_achillio_brand(out.get("footer_copyright")):
        out["footer_copyright"] = f"© {datetime.utcnow().year} {office_name}"

    logo = str(out.get("logo_url") or "").strip()
    # Keyword match OR opaque upload while brand/legal drifted to Achillio Travel.
    if (
        _looks_like_achillio_brand(logo)
        or brand_poisoned
        or (legal_poisoned and _is_opaque_uploaded_logo(logo))
    ):
        out["logo_url"] = ""

    hero = str(out.get("hero_image_url") or "").strip()
    if _looks_like_achillio_brand(hero):
        out["hero_image_url"] = ""

    return out


def _platform_appearance_needs_persist(
    stored: dict[str, Any] | None,
    cleaned: dict[str, Any],
) -> dict[str, Any] | None:
    """Fields to write back so Achillio poison does not resurrect on next read."""
    if not isinstance(stored, dict):
        return None
    patch: dict[str, Any] = {}
    for key in (
        "footer_brand_name",
        "rent_office_name",
        "footer_copyright",
        "logo_url",
        "hero_image_url",
    ):
        old = stored.get(key)
        new = cleaned.get(key)
        if old == new:
            continue
        if key == "logo_url" and not str(new or "").strip() and str(old or "").strip():
            patch[key] = ""
        elif _looks_like_achillio_brand(old) or (
            key == "hero_image_url" and _looks_like_achillio_brand(old)
        ):
            patch[key] = new if new is not None else ""
        elif key in ("footer_brand_name", "rent_office_name") and _looks_like_achillio_brand(old):
            patch[key] = new
    return patch or None


def _enrich_from_tenant(data: dict[str, Any], tenant: Tenant, settings: dict[str, Any]) -> dict[str, Any]:
    """Fill empty brand/logo from office legal name + branding settings."""
    from app.services.tenant_modules import is_poreiago_platform_office

    out = {**data}
    branding = settings.get("branding") if isinstance(settings.get("branding"), dict) else {}
    theme_cfg = tenant.theme_config if isinstance(tenant.theme_config, dict) else {}
    office_name = (tenant.legal_name or tenant.slug or "").strip()
    # Platform seed slug=achillio must not publish as Achillio Travel.
    if is_poreiago_platform_office(tenant) and (
        not office_name or _looks_like_achillio_brand(office_name) or office_name.lower() == "achillio"
    ):
        office_name = "PoreiaGo"

    branding_logo = str(theme_cfg.get("logoUrl") or branding.get("logo_url") or "").strip()
    if _is_platform_logo(branding_logo) or _looks_like_achillio_brand(branding_logo):
        branding_logo = ""

    current_logo = str(out.get("logo_url") or "").strip()
    if _is_platform_logo(current_logo) or _looks_like_achillio_brand(current_logo):
        out["logo_url"] = ""
        current_logo = ""

    if not current_logo and branding_logo:
        out["logo_url"] = branding_logo

    if not str(out.get("footer_brand_name") or "").strip() and office_name:
        out["footer_brand_name"] = office_name

    if not str(out.get("rent_office_name") or "").strip() and office_name:
        out["rent_office_name"] = office_name

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
        merged = _sanitize_poreiago_platform_appearance(merged, tenant)

        # One-shot heal: persist scrubbed Achillio leftovers so admin sidebar
        # and public hosts stop reloading poison from Postgres.
        from app.services.tenant_modules import is_poreiago_platform_office

        if is_poreiago_platform_office(tenant):
            persist = _platform_appearance_needs_persist(
                stored if isinstance(stored, dict) else None,
                merged,
            )
            if persist:
                base = dict(stored) if isinstance(stored, dict) else {}
                base.update(persist)
                settings["site_appearance"] = base
                tenant.settings_json = json.dumps(settings, ensure_ascii=False)
                await self._session.flush()

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
        updated = _sanitize_poreiago_platform_appearance(updated, tenant)
        # Keep an explicit non-Achillio upload even if legal_name still drifted.
        if "logo_url" in patch:
            explicit = str(patch.get("logo_url") or "").strip()
            if explicit and not _looks_like_achillio_brand(explicit):
                updated["logo_url"] = explicit
        # Clamp logo sizing if present.
        try:
            if "logo_height_px" in updated:
                updated["logo_height_px"] = max(20, min(96, int(updated["logo_height_px"])))
        except (TypeError, ValueError):
            updated["logo_height_px"] = 40
        try:
            if "logo_max_width_px" in updated:
                updated["logo_max_width_px"] = max(60, min(400, int(updated["logo_max_width_px"])))
        except (TypeError, ValueError):
            updated["logo_max_width_px"] = 180
        if "logo_show_name" in updated:
            updated["logo_show_name"] = bool(updated["logo_show_name"])
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
