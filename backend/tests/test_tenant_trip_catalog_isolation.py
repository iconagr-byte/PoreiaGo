"""Regression: tenant trip catalogs must not cross-contaminate offices."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from travel_platform.operations.tenant_trip_catalog_store import (
    list_tenant_trips,
    replace_tenant_catalog,
    upsert_tenant_trips,
)


class TenantTripCatalogIsolationTests(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.data_dir = Path(self._tmpdir.name)
        self._patch = patch.dict("os.environ", {"POREIAGO_DATA_DIR": str(self.data_dir)})
        self._patch.start()

    def tearDown(self):
        self._patch.stop()
        self._tmpdir.cleanup()

    def test_achillio_trip_not_visible_on_poreiago(self):
        achillio = "11111111-1111-1111-1111-111111111111"
        poreiago = "22222222-2222-2222-2222-222222222222"
        upsert_tenant_trips(
            achillio,
            [
                {
                    "id": 9001,
                    "title": "Achillio Μονεμβασιά",
                    "destination": "Μονεμβασιά",
                    "price": 45,
                    "status": "published",
                    "market": "domestic",
                }
            ],
        )
        self.assertEqual(len(list_tenant_trips(achillio)), 1)
        self.assertEqual(list_tenant_trips(poreiago), [])
        self.assertEqual(list_tenant_trips(None), [])

    def test_replace_catalog_is_tenant_scoped(self):
        tid = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        replace_tenant_catalog(
            tid,
            [
                {"id": 1, "title": "A", "price": 10, "status": "published"},
                {"id": 2, "title": "B", "price": 20, "status": "draft"},
            ],
        )
        published = list_tenant_trips(tid, published_only=True)
        self.assertEqual([t["id"] for t in published], [1])
        all_rows = list_tenant_trips(tid, published_only=False)
        self.assertEqual(sorted(t["id"] for t in all_rows), [1, 2])


if __name__ == "__main__":
    unittest.main()
