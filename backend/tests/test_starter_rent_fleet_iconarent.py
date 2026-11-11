"""IconaRent starter fleet seeds when empty (native wallet integration)."""

from __future__ import annotations

import json
import unittest
from pathlib import Path
from unittest.mock import patch

from travel_platform.rental import rental_store as store


class StarterRentFleetTests(unittest.TestCase):
    def setUp(self):
        self._tmp = Path(self.id().replace(".", "_"))
        # Use store fixture via monkeypatch on STORE_FILE in each test.

    def test_iconarent_slug_seeds_six_vehicles(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            data_file = Path(tmp) / "rental_store.json"
            data_file.write_text(
                json.dumps(
                    {"vehicles": [], "bookings": [], "inspections": [], "clients": []}
                ),
                encoding="utf-8",
            )
            with patch.object(store, "STORE_FILE", data_file):
                with patch.dict("os.environ", {"RENT_STARTER_FLEET_SLUGS": "iconarent"}):
                    tid = "0b0f6982-caa6-4efb-8e4e-7ea5a231f1cd"
                    n = store.ensure_starter_rent_fleet(tid, slug="iconarent")
                    self.assertEqual(n, 6)
                    rows = store.list_vehicles(tid)
                    self.assertEqual(len(rows), 6)
                    # Idempotent
                    self.assertEqual(
                        store.ensure_starter_rent_fleet(tid, slug="iconarent"), 0
                    )
                    self.assertEqual(len(store.list_vehicles(tid)), 6)

    def test_unknown_slug_does_not_seed(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            data_file = Path(tmp) / "rental_store.json"
            data_file.write_text(
                json.dumps(
                    {"vehicles": [], "bookings": [], "inspections": [], "clients": []}
                ),
                encoding="utf-8",
            )
            with patch.object(store, "STORE_FILE", data_file):
                with patch.dict("os.environ", {"RENT_STARTER_FLEET_SLUGS": "iconarent"}):
                    n = store.ensure_starter_rent_fleet("tenant-x", slug="other-office")
                    self.assertEqual(n, 0)
                    self.assertEqual(store.list_vehicles("tenant-x"), [])


if __name__ == "__main__":
    unittest.main()
