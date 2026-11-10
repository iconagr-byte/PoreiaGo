"""Production checkout base URL healing — no localhost in recovery links."""

from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from travel_platform.settings.checkout_base import (
    PRODUCTION_ACHILLIO_CHECKOUT,
    PRODUCTION_PLATFORM_CHECKOUT,
    heal_checkout_base_url,
    is_localhost_checkout_url,
    resolve_tenant_checkout_base,
)


class CheckoutBaseHelpersTests(unittest.TestCase):
    def test_detects_localhost(self):
        self.assertTrue(is_localhost_checkout_url("http://localhost:5173"))
        self.assertTrue(is_localhost_checkout_url("http://127.0.0.1:3000"))
        self.assertTrue(is_localhost_checkout_url(""))
        self.assertFalse(is_localhost_checkout_url("https://www.achilliotravel.com"))

    def test_heal_replaces_localhost(self):
        self.assertEqual(
            heal_checkout_base_url("http://localhost:5173"),
            PRODUCTION_PLATFORM_CHECKOUT,
        )
        self.assertEqual(
            heal_checkout_base_url("https://www.achilliotravel.com"),
            "https://www.achilliotravel.com",
        )

    def test_resolve_achillio_travel(self):
        tenant = SimpleNamespace(
            slug="admin-achillio-gr",
            subdomain="admin-achillio-gr",
            custom_domain="achilliotravel.com",
            legal_name="Achillio Travel",
        )
        self.assertEqual(resolve_tenant_checkout_base(tenant), PRODUCTION_ACHILLIO_CHECKOUT)

    def test_resolve_poreiago_platform(self):
        tenant = SimpleNamespace(
            slug="achillio",
            subdomain="achillio",
            custom_domain="",
            legal_name="PoreiaGo",
        )
        self.assertEqual(resolve_tenant_checkout_base(tenant), PRODUCTION_PLATFORM_CHECKOUT)

    def test_resolve_customer_subdomain(self):
        tenant = SimpleNamespace(
            slug="sunny-rentals",
            subdomain="sunny",
            custom_domain="",
            legal_name="Sunny",
        )
        self.assertEqual(
            resolve_tenant_checkout_base(tenant),
            "https://sunny.poreiago.com",
        )


class TenantPlatformSettingsHealTests(unittest.IsolatedAsyncioTestCase):
    async def test_get_settings_persists_healed_checkout(self):
        from app.services.tenant_platform_settings_service import TenantPlatformSettingsService

        tenant_id = uuid4()
        tenant = SimpleNamespace(
            id=tenant_id,
            slug="admin-achillio-gr",
            subdomain="admin-achillio-gr",
            custom_domain="achilliotravel.com",
            legal_name="Achillio Travel",
            settings_json='{"platform":{"checkout_base_url":"http://localhost:5173"}}',
        )

        session = AsyncMock()
        tenant_result = MagicMock()
        tenant_result.scalar_one_or_none.return_value = tenant
        session.execute = AsyncMock(return_value=tenant_result)
        session.flush = AsyncMock()

        with patch(
            "app.services.tenant_platform_settings_service.AuditService",
        ):
            service = TenantPlatformSettingsService(session)
            result = await service.get_settings(tenant_id)

        self.assertEqual(result["checkout_base_url"], PRODUCTION_ACHILLIO_CHECKOUT)
        self.assertIn(PRODUCTION_ACHILLIO_CHECKOUT, tenant.settings_json)
        session.flush.assert_awaited()

    async def test_missing_checkout_uses_office_origin(self):
        from app.services.tenant_platform_settings_service import TenantPlatformSettingsService

        tenant_id = uuid4()
        tenant = SimpleNamespace(
            id=tenant_id,
            slug="admin-achillio-gr",
            subdomain="admin-achillio-gr",
            custom_domain="achilliotravel.com",
            legal_name="Achillio Travel",
            settings_json='{"platform":{"company_name":"Achillio Travel"}}',
        )

        session = AsyncMock()
        tenant_result = MagicMock()
        tenant_result.scalar_one_or_none.return_value = tenant
        session.execute = AsyncMock(return_value=tenant_result)
        session.flush = AsyncMock()

        with patch(
            "app.services.tenant_platform_settings_service.AuditService",
        ):
            service = TenantPlatformSettingsService(session)
            result = await service.get_settings(tenant_id)

        self.assertEqual(result["checkout_base_url"], PRODUCTION_ACHILLIO_CHECKOUT)


if __name__ == "__main__":
    unittest.main()
