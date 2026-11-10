"""Native Wallet: /api/site/appearance?tenant_id= resolves office logo + name."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from api.site_appearance_router import (
    SiteAppearanceResponse,
    _appearance_for_tenant_id,
    get_public_site_appearance,
)


class AppearanceByTenantIdTests(unittest.IsolatedAsyncioTestCase):
    async def test_invalid_tenant_id_returns_none(self):
        out = await _appearance_for_tenant_id("not-a-uuid")
        self.assertIsNone(out)

    async def test_loads_logo_and_brand_name(self):
        tid = "11111111-1111-1111-1111-111111111111"
        fake = {
            "logo_url": "/api/site/office-assets/t/logo/office.png",
            "footer_brand_name": "Achillio Travel",
            "rent_office_name": "Achillio Travel",
            "logo_show_name": True,
            "tenant_slug": "admin-achillio-gr",
        }

        session_cm = MagicMock()
        session_cm.__aenter__ = AsyncMock(return_value=MagicMock())
        session_cm.__aexit__ = AsyncMock(return_value=None)

        svc = MagicMock()
        svc.get_appearance = AsyncMock(return_value=fake)

        with (
            patch("app.core.database.AsyncSessionLocal", return_value=session_cm),
            patch(
                "app.services.tenant_site_appearance_service.TenantSiteAppearanceService",
                return_value=svc,
            ),
        ):
            out = await _appearance_for_tenant_id(tid)

        self.assertIsInstance(out, SiteAppearanceResponse)
        self.assertEqual(out.logo_url, fake["logo_url"])
        self.assertEqual(out.footer_brand_name, "Achillio Travel")
        self.assertEqual(out.tenant_slug, "admin-achillio-gr")

    async def test_public_endpoint_prefers_tenant_id_query(self):
        req = MagicMock()
        branded = SiteAppearanceResponse(
            logo_url="/api/site/office-assets/t/logo/x.png",
            footer_brand_name="Demo Office",
        )
        with patch(
            "api.site_appearance_router._appearance_for_tenant_id",
            new=AsyncMock(return_value=branded),
        ) as mocked:
            out = await get_public_site_appearance(
                req,
                host=None,
                tenant_id="11111111-1111-1111-1111-111111111111",
            )
        mocked.assert_awaited_once()
        self.assertEqual(out.footer_brand_name, "Demo Office")
        self.assertEqual(out.logo_url, branded.logo_url)


if __name__ == "__main__":
    unittest.main()
