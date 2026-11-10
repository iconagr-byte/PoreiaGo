"""Tests for tenant fiscal settings service."""

from __future__ import annotations

import json
import unittest
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import core.exceptions  # noqa: F401 — bootstrap import order for travel_platform.compliance

from travel_platform.compliance.fiscal_secrets import decrypt_fiscal_secret, encrypt_fiscal_secret

from app.services.tenant_fiscal_settings_service import (
    TenantFiscalSettingsService,
    fiscal_settings_public_view,
)


class FiscalSecretsTests(unittest.TestCase):
    def test_encrypt_decrypt_roundtrip(self):
        plain = "secret-token-123"
        enc = encrypt_fiscal_secret(plain)
        self.assertTrue(enc.startswith("enc:"))
        self.assertEqual(decrypt_fiscal_secret(enc[4:]), plain)


class FiscalSettingsPublicViewTests(unittest.TestCase):
    def test_masks_secrets(self):
        fiscal = {
            "provider": "prosvasis",
            "prosvasis": {
                "app_id": "703",
                "s1code_enc": "enc:abc",
                "bearer_token_enc": "enc:def",
            },
        }
        view = fiscal_settings_public_view(fiscal)
        self.assertEqual(view["provider"], "prosvasis")
        self.assertTrue(view["prosvasis"]["s1code_configured"])
        self.assertTrue(view["prosvasis"]["bearer_token_configured"])
        self.assertNotIn("s1code_enc", view["prosvasis"])

    def test_masks_softone_api_key(self):
        fiscal = {
            "provider": "softone",
            "softone": {
                "api_url": "https://einvoice.s1ecos.gr",
                "api_key_enc": "enc:abc",
            },
        }
        view = fiscal_settings_public_view(fiscal)
        self.assertTrue(view["softone"]["api_key_configured"])
        self.assertNotIn("api_key_enc", view["softone"])

    def test_masks_impact_api_key(self):
        fiscal = {
            "provider": "impact",
            "impact": {
                "api_url": "https://einvoiceapi.impact.gr",
                "api_key_enc": "enc:xyz",
            },
        }
        view = fiscal_settings_public_view(fiscal)
        self.assertTrue(view["impact"]["api_key_configured"])
        self.assertNotIn("api_key_enc", view["impact"])


class TenantFiscalSettingsServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_update_encrypts_prosvasis_secrets(self):
        tenant_id = uuid4()
        tenant = MagicMock()
        tenant.id = tenant_id
        tenant.slug = "demo"
        tenant.settings_json = None

        session = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = tenant
        session.execute.return_value = result

        audit = AsyncMock()
        service = TenantFiscalSettingsService(session)
        service._audit = audit

        updated = await service.update_settings(
            tenant_id,
            {
                "provider": "prosvasis",
                "issuer_vat": "123456789",
                "prosvasis": {
                    "app_id": "703",
                    "s1code": "my-s1",
                    "bearer_token": "tok-xyz",
                },
            },
        )

        stored = json.loads(tenant.settings_json)
        prosvasis = stored["fiscal"]["prosvasis"]
        self.assertTrue(prosvasis["s1code_enc"].startswith("enc:"))
        self.assertTrue(prosvasis["bearer_token_enc"].startswith("enc:"))
        self.assertEqual(updated["issuer_vat"], "123456789")
        self.assertTrue(updated["prosvasis"]["s1code_configured"])
        audit.record.assert_awaited_once()

    async def test_update_encrypts_softone_api_key(self):
        tenant_id = uuid4()
        tenant = MagicMock()
        tenant.id = tenant_id
        tenant.slug = "demo"
        tenant.settings_json = None

        session = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = tenant
        session.execute.return_value = result

        service = TenantFiscalSettingsService(session)
        service._audit = AsyncMock()

        updated = await service.update_settings(
            tenant_id,
            {
                "provider": "softone",
                "issuer_vat": "999999999",
                "softone": {
                    "api_url": "https://einvoice.s1ecos.gr",
                    "api_key": "so-secret",
                    "item_code": "TRAVEL",
                },
            },
        )

        stored = json.loads(tenant.settings_json)
        softone = stored["fiscal"]["softone"]
        self.assertTrue(softone["api_key_enc"].startswith("enc:"))
        self.assertNotIn("api_key", softone)
        self.assertTrue(updated["softone"]["api_key_configured"])
        self.assertEqual(updated["provider"], "softone")


if __name__ == "__main__":
    unittest.main()
