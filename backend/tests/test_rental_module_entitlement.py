"""Rent module entitlement + public services catalog wiring."""

from __future__ import annotations

import unittest

from travel_platform.rental.rental_module_entitlement import (
    DEFAULT_ENTITLEMENT,
    is_rent_enabled,
    read_rent_module,
    update_rent_module,
)


class RentModuleEntitlementTests(unittest.TestCase):
    def setUp(self) -> None:
        # Reset to defaults for isolation.
        update_rent_module(
            {
                "rent_enabled": DEFAULT_ENTITLEMENT["rent_enabled"],
                "rent_addon_monthly_eur": DEFAULT_ENTITLEMENT["rent_addon_monthly_eur"],
                "note": "",
            }
        )

    def test_default_enabled(self) -> None:
        mod = read_rent_module()
        self.assertTrue(mod["rent_enabled"])
        self.assertTrue(is_rent_enabled())
        self.assertGreaterEqual(float(mod["rent_addon_monthly_eur"]), 0)

    def test_toggle_off_and_on(self) -> None:
        update_rent_module({"rent_enabled": False})
        self.assertFalse(is_rent_enabled())
        update_rent_module({"rent_enabled": True, "rent_addon_monthly_eur": 99})
        mod = read_rent_module()
        self.assertTrue(mod["rent_enabled"])
        self.assertEqual(mod["rent_addon_monthly_eur"], 99.0)


if __name__ == "__main__":
    unittest.main()
