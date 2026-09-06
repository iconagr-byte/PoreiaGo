"""PoreiaGo platform office must never surface Achillio Travel branding."""

from __future__ import annotations

from types import SimpleNamespace

from app.models.tenant import TenantPlan
from app.services.tenant_site_appearance_service import (
    _sanitize_poreiago_platform_appearance,
    _enrich_from_tenant,
)


def test_sanitize_replaces_achillio_brand_on_platform_seed():
    tenant = SimpleNamespace(
        slug="achillio",
        subdomain="achillio",
        custom_domain=None,
        legal_name="Achillio Travel",
        plan=TenantPlan.PROFESSIONAL,
        settings_json=None,
        theme_config=None,
    )
    cleaned = _sanitize_poreiago_platform_appearance(
        {
            "footer_brand_name": "Achillio Travel",
            "rent_office_name": "Achillion",
            "logo_url": "/images/achillio-logo.png",
            "hero_image_url": "/images/hero-bus-achillio.png",
            "hero_title": "Η Ελλάδα",
        },
        tenant,
    )
    assert cleaned["footer_brand_name"] == "PoreiaGo"
    assert cleaned["rent_office_name"] == "PoreiaGo"
    assert cleaned["logo_url"] == ""
    assert cleaned["hero_image_url"] == ""
    assert cleaned["hero_title"] == "Η Ελλάδα"


def test_sanitize_clears_opaque_logo_when_brand_drifted_to_achillio():
    """data:/assets logos have no 'achillio' in the URL but still leak the mark."""
    tenant = SimpleNamespace(
        slug="achillio",
        subdomain="achillio",
        custom_domain=None,
        legal_name="Achillio Travel",
        plan=TenantPlan.PROFESSIONAL,
        settings_json=None,
        theme_config=None,
    )
    cleaned = _sanitize_poreiago_platform_appearance(
        {
            "footer_brand_name": "Achillio Travel",
            "rent_office_name": "Achillio Travel",
            "logo_url": "data:image/png;base64,AAA",
            "hero_image_url": "/api/site/assets/hero",
        },
        tenant,
    )
    assert cleaned["footer_brand_name"] == "PoreiaGo"
    assert cleaned["logo_url"] == ""


def test_enrich_does_not_publish_achillio_legal_name_for_platform():
    tenant = SimpleNamespace(
        slug="achillio",
        subdomain="achillio",
        custom_domain=None,
        legal_name="Achillio Travel",
        plan=TenantPlan.PROFESSIONAL,
        settings_json=None,
        theme_config={},
    )
    out = _enrich_from_tenant(
        {
            "footer_brand_name": "",
            "rent_office_name": "",
            "logo_url": "",
            "footer_copyright": "",
        },
        tenant,
        {},
    )
    assert out["footer_brand_name"] == "PoreiaGo"
    assert out["display_name"] == "PoreiaGo"
