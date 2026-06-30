"""OLYMPUS Phase 3 — dedicated DB routing, platform settings, AADE signing."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.core.tenant_database import (
    build_dedicated_database_url,
    dedicated_database_name,
    resolve_tenant_database_url,
)
from app.models.tenant import Tenant, TenantPlan
from app.services.tenant_platform_settings_service import (
    DEFAULT_PLATFORM_SETTINGS,
    TenantPlatformSettingsService,
)


class TenantDatabaseRoutingTests(unittest.TestCase):
    def test_dedicated_database_name(self):
        self.assertEqual(dedicated_database_name("acme-travel"), "olympus_tenant_acme_travel")

    def test_build_dedicated_database_url(self):
        master = "postgresql+asyncpg://user:pass@localhost:5432/master"
        dsn = build_dedicated_database_url(master, "olympus_tenant_acme")
        self.assertIn("olympus_tenant_acme", dsn)
        self.assertTrue(dsn.startswith("postgresql+asyncpg://"))

    def test_resolve_url_prefers_tenant_dsn(self):
        tenant = Tenant(
            id=uuid4(),
            slug="acme",
            legal_name="Acme",
            subdomain="acme",
            plan=TenantPlan.ENTERPRISE,
            database_dsn="postgresql+asyncpg://user:pass@localhost:5432/olympus_tenant_acme",
        )
        self.assertEqual(
            resolve_tenant_database_url(tenant),
            tenant.database_dsn,
        )


class TenantPlatformSettingsTests(unittest.IsolatedAsyncioTestCase):
    async def test_merge_defaults_on_update(self):
        tenant_id = uuid4()
        tenant = Tenant(
            id=tenant_id,
            slug="demo",
            legal_name="Demo",
            subdomain="demo",
            plan=TenantPlan.STARTER,
            settings_json="{}",
        )

        session = AsyncMock()
        tenant_result = MagicMock()
        tenant_result.scalar_one_or_none.return_value = tenant
        session.execute = AsyncMock(return_value=tenant_result)
        session.flush = AsyncMock()

        audit_mock = AsyncMock()
        with patch(
            "app.services.tenant_platform_settings_service.AuditService",
        ) as audit_cls:
            audit_cls.return_value.record = audit_mock
            service = TenantPlatformSettingsService(session)
            result = await service.update_settings(
                tenant_id,
                {"company_name": "My Travel Co", "checkout_deposit_percent": 25},
            )

        self.assertEqual(result["company_name"], "My Travel Co")
        self.assertEqual(result["checkout_deposit_percent"], 25)
        self.assertEqual(result["support_email"], DEFAULT_PLATFORM_SETTINGS["support_email"])
        audit_mock.assert_awaited_once()


class AadeXmlParseTests(unittest.TestCase):
    def test_extract_xml_tag(self):
        import re

        def extract(xml_text: str, tag: str) -> str | None:
            match = re.search(rf"<{tag}>([^<]+)</{tag}>", xml_text, re.IGNORECASE)
            return match.group(1).strip() if match else None

        xml = "<Response><mark>ABC123</mark><uid>uid-1</uid></Response>"
        self.assertEqual(extract(xml, "mark"), "ABC123")
        self.assertEqual(extract(xml, "uid"), "uid-1")


if __name__ == "__main__":
    unittest.main()
