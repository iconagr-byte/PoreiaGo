"""Office SEO shell rewriter — host-aware titles for Googlebot."""

from __future__ import annotations

import unittest

from app.services.office_seo import (
    PLATFORM_TITLE,
    inject_office_seo_into_html,
    resolve_seo_payload,
)


class OfficeSeoTests(unittest.TestCase):
    def test_achillio_host_never_poreiago(self):
        seo = resolve_seo_payload(host="www.achilliotravel.com")
        self.assertEqual(seo["title"], "Achillio Travel — Εκδρομές με λεωφορείο")
        self.assertIn("Achillio", seo["description"])
        self.assertNotIn("PoreiaGo", seo["title"])
        self.assertFalse(seo["is_platform"])
        self.assertIn("achilliotravel.com", seo["canonical_url"])

    def test_platform_host_keeps_poreiago(self):
        seo = resolve_seo_payload(host="www.poreiago.com")
        self.assertEqual(seo["title"], PLATFORM_TITLE)
        self.assertTrue(seo["is_platform"])

    def test_unknown_office_uses_brand_not_platform(self):
        seo = resolve_seo_payload(
            host="sunnybuses.gr",
            display_name="Sunny Buses",
            hero_title="Εκδρομές",
            hero_subtitle="Κράτησε θέση online",
        )
        self.assertEqual(seo["title"], "Sunny Buses")
        self.assertIn("Sunny Buses", seo["description"])
        self.assertNotIn("PoreiaGo", seo["title"])

    def test_inject_rewrites_static_shell(self):
        raw = """<!doctype html><html><head>
    <title>PoreiaGo — Πλατφόρμα για ταξιδιωτικά γραφεία</title>
    <meta property="og:title" content="PoreiaGo — Πλατφόρμα για ταξιδιωτικά γραφεία" />
    <meta name="twitter:title" content="PoreiaGo — Πλατφόρμα για ταξιδιωτικά γραφεία" />
    <meta name="application-name" content="PoreiaGo" />
  </head><body></body></html>"""
        seo = resolve_seo_payload(host="achilliotravel.com")
        out = inject_office_seo_into_html(raw, seo)
        self.assertIn("<title>Achillio Travel — Εκδρομές με λεωφορείο</title>", out)
        self.assertIn('content="Achillio Travel"', out)
        self.assertIn('name="description"', out)
        self.assertIn("application/ld+json", out)
        self.assertNotIn("PoreiaGo —", out)


if __name__ == "__main__":
    unittest.main()
