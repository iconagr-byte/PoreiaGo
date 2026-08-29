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


if __name__ == "__main__":
    unittest.main()
