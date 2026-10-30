"""Achillio Travel gets PoreiaGo-style starter excursions in its own catalog."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from travel_platform.operations.achillio_seed_trips import (
    ACHILLIO_SEED_TRIP_IDS,
    achillio_seed_trip_catalog,
    seed_achillio_office_excursions,
)
from travel_platform.operations.tenant_trip_catalog_store import list_tenant_trips


class AchillioSeedTripsTests(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.data_dir = Path(self._tmpdir.name)
        self._patch = patch.dict("os.environ", {"POREIAGO_DATA_DIR": str(self.data_dir)})
        self._patch.start()
        self.tenant = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

    def tearDown(self):
        self._patch.stop()
        self._tmpdir.cleanup()

    def test_seed_catalog_has_three_domestic_showcase_trips(self):
        trips = achillio_seed_trip_catalog()
        self.assertEqual(len(trips), 3)
        titles = {t["title"] for t in trips}
        self.assertIn("Ημερήσια στα Μετέωρα", titles)
        self.assertIn("Απόδραση στην Πρωτεύουσα", titles)
        self.assertIn("Μαγευτικά Ιωάννινα", titles)
        for t in trips:
            self.assertTrue(t.get("officeSeed"))
            self.assertIn(t["id"], ACHILLIO_SEED_TRIP_IDS)

    def test_seed_departures_roll_forward_past_june_2026(self):
        from datetime import datetime, timezone

        trips = achillio_seed_trip_catalog()
        now = datetime.now(timezone.utc)
        for t in trips:
            dep = datetime.fromisoformat(t["departureTime"].replace("Z", "+00:00"))
            self.assertGreater(dep, now, msg=t["title"])
            # Must stay boardable for My Wallet (12h grace after departure).
            self.assertGreater((dep - now).total_seconds(), 12 * 3600)

    def test_seed_upserts_into_tenant_catalog_idempotently(self):
        first = seed_achillio_office_excursions(self.tenant)
        self.assertEqual(first["saved"], 3)
        rows = list_tenant_trips(self.tenant, published_only=True)
        self.assertEqual(len(rows), 3)
        self.assertTrue(all(r.get("officeSeed") for r in rows))

        second = seed_achillio_office_excursions(self.tenant)
        self.assertEqual(second["saved"], 3)
        rows2 = list_tenant_trips(self.tenant, published_only=True)
        self.assertEqual(len(rows2), 3)


if __name__ == "__main__":
    unittest.main()
