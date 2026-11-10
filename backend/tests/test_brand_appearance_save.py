"""Brand / logo appearance saves must survive poisoned settings_json bags."""

from __future__ import annotations

import json
import unittest
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from app.services.tenant_site_appearance_service import (
    DEFAULT_SITE_APPEARANCE,
    TenantSiteAppearanceService,
    _is_brand_logo_only_patch,
    _safe_settings_json,
    coerce_appearance_for_response,
)


class BrandAppearanceSaveTests(unittest.IsolatedAsyncioTestCase):
    def test_brand_logo_only_patch_detection(self):
        self.assertTrue(
            _is_brand_logo_only_patch(
                {
                    "footer_brand_name": "Achillio Travel",
                    "rent_office_name": "Achillio Travel",
                    "logo_height_px": 96,
                    "logo_max_width_px": 320,
                    "logo_url": "/api/site/office-assets/t/logo/logo.jpg",
                }
            )
        )
        self.assertFalse(
            _is_brand_logo_only_patch(
                {"footer_brand_name": "X", "hero_title": "New hero"}
            )
        )

    def test_safe_settings_json_strips_nul_bytes(self):
        raw = _safe_settings_json(
            {"site_appearance": {"footer_brand_name": "Ach\x00illio", "logo_url": "ok"}}
        )
        self.assertNotIn("\x00", raw)
        self.assertIn("Achillio", raw)

    def test_coerce_replaces_nulls_for_response(self):
        coerced = coerce_appearance_for_response(
            {
                "logo_height_px": None,
                "home_slider_slides": None,
                "footer_brand_name": None,
                "rent_coverage_options": None,
            }
        )
        self.assertEqual(coerced["logo_height_px"], 40)
        self.assertEqual(coerced["home_slider_slides"], [])
        self.assertEqual(coerced["footer_brand_name"], "")
        self.assertEqual(coerced["rent_coverage_options"], [])

    async def test_brand_save_uses_slim_write_with_poisoned_bag(self):
        tenant_id = uuid4()
        huge = "data:image/jpeg;base64," + ("A" * 50_000)
        poisoned = {
            "site_appearance": {
                **DEFAULT_SITE_APPEARANCE,
                "logo_url": "/api/site/office-assets/t/logo/logo.jpg",
                "footer_brand_name": "Old",
                "home_slider_slides": [{"image_url": huge, "title": "x"}] * 20,
            },
            "branding": {"logo_url": huge},
            "theme": {"inline_css": "x" * 100_000},
        }
        tenant = MagicMock()
        tenant.id = tenant_id
        tenant.slug = "admin-achillio-gr"
        tenant.legal_name = "Achillio Travel"
        tenant.settings_json = json.dumps(poisoned)

        session = AsyncMock()
        session.flush = AsyncMock()
        session.rollback = AsyncMock()
        nested = AsyncMock()
        nested.__aenter__ = AsyncMock(return_value=None)
        nested.__aexit__ = AsyncMock(return_value=False)
        session.begin_nested = MagicMock(return_value=nested)

        result = MagicMock()
        result.scalar_one_or_none.return_value = tenant
        session.execute = AsyncMock(return_value=result)

        svc = TenantSiteAppearanceService(session)
        svc._audit = MagicMock()
        svc._audit.record = AsyncMock(side_effect=RuntimeError("audit down"))

        out = await svc.update_appearance(
            tenant_id,
            {
                "footer_brand_name": "Achillio Travel",
                "rent_office_name": "Achillio Travel",
                "logo_height_px": 96,
                "logo_max_width_px": 320,
                "logo_url": "/api/site/office-assets/t/logo/logo.jpg",
            },
            actor_email="admin@achilliotravel.com",
        )

        self.assertEqual(out["footer_brand_name"], "Achillio Travel")
        self.assertEqual(out["logo_height_px"], 96)
        self.assertEqual(out["logo_max_width_px"], 320)
        self.assertNotIn("AAAAA", tenant.settings_json)
        written = json.loads(tenant.settings_json)
        self.assertEqual(written["site_appearance"]["footer_brand_name"], "Achillio Travel")
        self.assertEqual(written["site_appearance"]["logo_height_px"], 96)
        session.flush.assert_awaited()

    async def test_nuclear_retry_does_not_remerge_poison(self):
        tenant_id = uuid4()
        tenant = MagicMock()
        tenant.id = tenant_id
        tenant.slug = "admin-achillio-gr"
        tenant.legal_name = "Achillio Travel"
        tenant.settings_json = json.dumps(
            {
                "site_appearance": {
                    **DEFAULT_SITE_APPEARANCE,
                    "hero_title": "poison\x00title",
                    "home_slider_slides": [
                        {"image_url": "data:image/png;base64," + ("B" * 30_000)}
                    ],
                }
            }
        )

        session = AsyncMock()
        calls = {"n": 0}

        async def flush_once_fail():
            calls["n"] += 1
            if calls["n"] == 1:
                raise RuntimeError("simulated write failure")

        session.flush = AsyncMock(side_effect=flush_once_fail)
        session.rollback = AsyncMock()
        nested = AsyncMock()
        nested.__aenter__ = AsyncMock(return_value=None)
        nested.__aexit__ = AsyncMock(return_value=False)
        session.begin_nested = MagicMock(return_value=nested)

        result = MagicMock()
        result.scalar_one_or_none.return_value = tenant
        session.execute = AsyncMock(return_value=result)

        svc = TenantSiteAppearanceService(session)
        svc._audit = MagicMock()
        svc._audit.record = AsyncMock()

        out = await svc.update_appearance(
            tenant_id,
            {
                "footer_brand_name": "Achillio Travel",
                "logo_height_px": 96,
                "logo_max_width_px": 320,
            },
            actor_email="admin@achilliotravel.com",
        )

        self.assertEqual(out["footer_brand_name"], "Achillio Travel")
        self.assertEqual(out["logo_height_px"], 96)
        self.assertEqual(calls["n"], 2)
        session.rollback.assert_awaited()
        self.assertNotIn("\x00", tenant.settings_json)
        written = json.loads(tenant.settings_json)
        self.assertEqual(written["site_appearance"]["footer_brand_name"], "Achillio Travel")


if __name__ == "__main__":
    unittest.main()
