"""PoreiaGo platform must never keep Achillio Travel domain/name in branding."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.tenant_branding_service import TenantBrandingService, _is_achillio_travel_host


def test_achillio_travel_host_detection():
    assert _is_achillio_travel_host("www.achilliotravel.com") is True
    assert _is_achillio_travel_host("achilliotravel.com") is True
    assert _is_achillio_travel_host("poreiago.com") is False


@pytest.mark.asyncio
async def test_heal_clears_stolen_domain_on_platform_seed():
    tenant = SimpleNamespace(
        id="11111111-1111-1111-1111-111111111111",
        slug="achillio",
        subdomain="achillio",
        custom_domain="achilliotravel.com",
        legal_name="Achillio Travel",
        settings_json='{"branding":{"checkout_base_url":"https://www.achilliotravel.com"}}',
        theme_config={},
    )
    session = MagicMock()
    session.flush = AsyncMock()
    svc = TenantBrandingService(session)
    svc._olympus = {"base_domain": "poreiago.com", "ingress_cname": "x"}

    healed = await svc._heal_foreign_achillio_domain(tenant)
    assert healed is True
    assert tenant.custom_domain is None
    assert tenant.legal_name == "PoreiaGo"
    assert "achilliotravel" not in (tenant.settings_json or "").lower()


@pytest.mark.asyncio
async def test_heal_keeps_domain_on_real_achillio_travel():
    tenant = SimpleNamespace(
        id="22222222-2222-2222-2222-222222222222",
        slug="admin-achillio-gr",
        subdomain="admin-achillio-gr",
        custom_domain="achilliotravel.com",
        legal_name="Achillio Travel",
        settings_json=None,
        theme_config={},
    )
    session = MagicMock()
    session.flush = AsyncMock()
    svc = TenantBrandingService(session)
    svc._olympus = {"base_domain": "poreiago.com", "ingress_cname": "x"}

    healed = await svc._heal_foreign_achillio_domain(tenant)
    assert healed is False
    assert tenant.custom_domain == "achilliotravel.com"
    assert tenant.legal_name == "Achillio Travel"
