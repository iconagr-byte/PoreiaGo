"""Demo catalog must not seed or remain visible in production offices."""

from __future__ import annotations

import os
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]


class DemoCatalogContractTests(unittest.TestCase):
    def test_demo_refs_cover_seed_bookings(self) -> None:
        from ticketing.demo_catalog import DEMO_BOOKING_REFS, DEMO_TRIP_TITLES, is_demo_booking_ref

        for ref in ("BK-1029", "B-0995", "BK-1031"):
            self.assertTrue(is_demo_booking_ref(ref))
        self.assertIn("Ημερήσια στα Μετέωρα", DEMO_TRIP_TITLES)
        self.assertIn("3ήμερο Ναύπλιο", DEMO_TRIP_TITLES)
        self.assertTrue(len(DEMO_BOOKING_REFS) >= 4)

    def test_production_disables_demo_seeds(self) -> None:
        from ticketing.demo_catalog import allow_demo_seeds

        with mock.patch.dict(os.environ, {"ENVIRONMENT": "production"}, clear=False):
            self.assertFalse(allow_demo_seeds())
        with mock.patch.dict(
            os.environ,
            {"ENVIRONMENT": "development", "ALLOW_DEMO_BOOKING_SEED": "true"},
            clear=False,
        ):
            self.assertTrue(allow_demo_seeds())

    def test_main_purges_instead_of_seeding_in_prod_path(self) -> None:
        main = (ROOT / "backend" / "main.py").read_text(encoding="utf-8")
        self.assertIn("allow_demo_seeds", main)
        self.assertIn("purge_seed_demo_catalog", main)

    def test_frontend_strips_demo_catalog(self) -> None:
        js = (ROOT / "src" / "lib" / "admin" / "demoCatalog.js").read_text(encoding="utf-8")
        self.assertIn("stripDemoTrips", js)
        self.assertIn("stripDemoBookings", js)
        store = (ROOT / "src" / "lib" / "trips" / "tripStore.js").read_text(encoding="utf-8")
        self.assertIn("stripDemoTrips", store)
        bookings = (ROOT / "src" / "lib" / "ticketing" / "bookingStore.js").read_text(
            encoding="utf-8"
        )
        self.assertIn("stripDemoBookings", bookings)


if __name__ == "__main__":
    unittest.main()
