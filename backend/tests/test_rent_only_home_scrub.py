"""Rent-only offices must not keep bus homepage / SEO copy."""

from __future__ import annotations

import unittest

from app.models.tenant import TenantPlan
from app.services.office_seo import build_office_description, resolve_seo_payload
from app.services.tenant_modules import initial_settings_for_plan
from app.services.tenant_site_appearance_service import (
    DEFAULT_SITE_APPEARANCE,
    scrub_bus_home_copy_for_rent_only,
)


class RentOnlyHomeScrubTests(unittest.TestCase):
    def test_seed_overrides_bus_hero_slots(self):
        seed = initial_settings_for_plan(TenantPlan.RENT, office_name="IconaRent")
        appearance = seed["site_appearance"]
        self.assertEqual(appearance["hero_title"], "Ενοικίαση αυτοκινήτου")
        self.assertIn("οχημάτων", appearance["hero_search_label"])
        self.assertNotIn("εκδρομ", appearance["hero_subtitle"].lower())
        self.assertNotEqual(
            appearance["hero_title"],
            DEFAULT_SITE_APPEARANCE["hero_title"],
        )
        self.assertIs(appearance["wallet_home_show_trips"], False)

    def test_scrub_replaces_bus_defaults_keeps_custom(self):
        scrubbed, persist = scrub_bus_home_copy_for_rent_only(
            {
                "hero_title": DEFAULT_SITE_APPEARANCE["hero_title"],
                "hero_subtitle": DEFAULT_SITE_APPEARANCE["hero_subtitle"],
                "hero_badge": DEFAULT_SITE_APPEARANCE["hero_badge"],
                "hero_title_accent": DEFAULT_SITE_APPEARANCE["hero_title_accent"],
                "hero_search_label": DEFAULT_SITE_APPEARANCE["hero_search_label"],
                "rent_guest_hero_title": "ICONA RENT στόλος",
                "rent_hero_copy": "Παραλαβή στο αεροδρόμιο.",
            }
        )
        self.assertEqual(scrubbed["hero_title"], "ICONA RENT στόλος")
        self.assertEqual(scrubbed["hero_subtitle"], "Παραλαβή στο αεροδρόμιο.")
        self.assertIs(scrubbed["wallet_home_show_trips"], False)
        self.assertIn("hero_title", persist)
        self.assertNotIn("εκδρομ", scrubbed["hero_subtitle"].lower())

        custom, persist2 = scrub_bus_home_copy_for_rent_only(
            {
                "hero_title": "Το δικό μας rent tagline",
                "hero_subtitle": "Κλείσε Jeep για τις Κυκλάδες",
                "wallet_home_show_trips": False,
            }
        )
        self.assertEqual(custom["hero_title"], "Το δικό μας rent tagline")
        self.assertNotIn("hero_title", persist2)

    def test_seo_description_uses_rent_copy(self):
        seo = resolve_seo_payload(
            host="iconarent.poreiago.com",
            display_name="IconaRent",
            hero_title="Ενοικίαση αυτοκινήτου",
            hero_subtitle="Κράτηση και παραλαβή σε λίγα βήματα.",
        )
        self.assertIn("Ενοικίαση αυτοκινήτου", seo["description"])
        self.assertNotIn("εκδρομές", seo["description"].lower())
        desc = build_office_description(
            "IconaRent",
            hero_title="Ενοικίαση αυτοκινήτου",
            hero_subtitle="Στόλος γραφείου.",
        )
        self.assertIn("Στόλος γραφείου", desc)


if __name__ == "__main__":
    unittest.main()
