"""Prune oversized data: URLs from site appearance before Postgres write."""

from __future__ import annotations

import unittest


class PruneOversizedMediaTests(unittest.TestCase):
    def test_strips_huge_logo_and_slide_data_urls(self):
        from app.services.tenant_site_appearance_service import _prune_oversized_media

        huge = "data:image/jpeg;base64," + ("A" * 20_000)
        cleaned = _prune_oversized_media(
            {
                "logo_url": huge,
                "hero_image_url": "/api/site/office-assets/x/hero/hero.jpg",
                "home_slider_slides": [{"image_url": huge, "title": "A"}],
            }
        )
        self.assertEqual(cleaned["logo_url"], "")
        self.assertTrue(cleaned["hero_image_url"].startswith("/api/site/"))
        self.assertEqual(cleaned["home_slider_slides"][0]["image_url"], "")
        self.assertEqual(cleaned["home_slider_slides"][0]["title"], "A")

    def test_keeps_short_urls(self):
        from app.services.tenant_site_appearance_service import _prune_oversized_media

        url = "/api/site/office-assets/tid/logo/logo.jpg"
        cleaned = _prune_oversized_media(
            {"logo_url": url, "hero_image_url": "data:image/png;base64,AAA"}
        )
        self.assertEqual(cleaned["logo_url"], url)
        self.assertTrue(cleaned["hero_image_url"].startswith("data:image/png"))

    def test_deep_prune_strips_branding_data_urls(self):
        from app.services.tenant_site_appearance_service import (
            _prune_oversized_data_urls_deep,
            _safe_settings_json,
        )

        huge = "data:image/png;base64," + ("B" * 12_000)
        settings = {
            "branding": {"logo_url": huge, "primary_color": "#123"},
            "site_appearance": {
                "logo_url": "/api/site/office-assets/t/logo/logo.jpg",
                "hero_image_url": huge,
            },
            "other": "ok",
        }
        cleaned = _prune_oversized_data_urls_deep(settings)
        self.assertEqual(cleaned["branding"]["logo_url"], "")
        self.assertEqual(cleaned["branding"]["primary_color"], "#123")
        self.assertEqual(
            cleaned["site_appearance"]["logo_url"],
            "/api/site/office-assets/t/logo/logo.jpg",
        )
        self.assertEqual(cleaned["site_appearance"]["hero_image_url"], "")
        raw = _safe_settings_json(settings)
        self.assertNotIn("BBBBB", raw)
        self.assertIn("office-assets", raw)


if __name__ == "__main__":
    unittest.main()
