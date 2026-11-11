"""SaaS branding schemas must accept rent_pickup_locations (office → /rent + wallet)."""

from __future__ import annotations

import unittest

from app.api.schemas import TenantSiteAppearanceResponse, TenantSiteAppearanceUpdate


class TenantAppearancePickupLocationsTests(unittest.TestCase):
    def test_update_accepts_pickup_locations(self):
        body = TenantSiteAppearanceUpdate(
            rent_pickup_locations=["Έδεσσα", "Θεσσαλονίκη"],
            footer_address="Ιψώνα 1",
        )
        patch = body.model_dump(exclude_unset=True)
        self.assertEqual(patch["rent_pickup_locations"], ["Έδεσσα", "Θεσσαλονίκη"])
        self.assertEqual(patch["footer_address"], "Ιψώνα 1")

    def test_response_includes_pickup_locations(self):
        resp = TenantSiteAppearanceResponse(
            rent_pickup_locations=["Αεροδρόμιο", "Λιμάνι"],
            footer_address="Γραφείο",
        )
        self.assertEqual(resp.rent_pickup_locations, ["Αεροδρόμιο", "Λιμάνι"])
        self.assertEqual(resp.footer_address, "Γραφείο")
        self.assertIn("rent_pickup_locations", TenantSiteAppearanceResponse.model_fields)
        self.assertIn("rent_pickup_locations", TenantSiteAppearanceUpdate.model_fields)


if __name__ == "__main__":
    unittest.main()
