"""Minimal logo URL writer for office asset uploads."""

from __future__ import annotations

import asyncio
import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4


class ForceSetMediaUrlTests(unittest.TestCase):
    def test_force_set_media_url_writes_short_logo_and_prunes_poison(self):
        from app.services import tenant_site_appearance_service as mod

        tid = uuid4()
        huge = "data:image/png;base64," + ("X" * 12_000)
        tenant = SimpleNamespace(
            id=tid,
            slug="admin-achillio-gr",
            legal_name="Achillio Travel",
            settings_json=json.dumps(
                {
                    "branding": {"logo_url": huge},
                    "site_appearance": {
                        "footer_brand_name": "Achillio Travel",
                        "logo_url": huge,
                    },
                }
            ),
            theme_config={},
        )

        class _Result:
            def scalar_one_or_none(self):
                return tenant

        session = AsyncMock()
        session.execute = AsyncMock(return_value=_Result())
        session.flush = AsyncMock()

        svc = mod.TenantSiteAppearanceService(session)
        url = f"/api/site/office-assets/{tid}/logo/logo.jpg"

        async def _run():
            with patch.object(
                svc,
                "get_appearance",
                new=AsyncMock(
                    return_value={
                        "logo_url": url,
                        "footer_brand_name": "Achillio Travel",
                        "tenant_slug": "admin-achillio-gr",
                        "storage_source": "postgres",
                    }
                ),
            ):
                return await svc.force_set_media_url(tid, logo_url=url)

        out = asyncio.run(_run())
        bag = json.loads(tenant.settings_json)
        self.assertEqual(bag["site_appearance"]["logo_url"], url)
        self.assertEqual(bag["branding"]["logo_url"], url)
        self.assertNotIn("XXXXX", tenant.settings_json)
        self.assertEqual(out["logo_url"], url)
        session.flush.assert_awaited()


if __name__ == "__main__":
    unittest.main()
