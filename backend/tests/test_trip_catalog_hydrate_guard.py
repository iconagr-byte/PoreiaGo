"""Guard: incomplete local replace_catalog must not wipe durable office trips."""

from __future__ import annotations

import asyncio
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from travel_platform.operations.tenant_trip_catalog_store import (
    list_tenant_trips,
    replace_tenant_catalog,
)
from travel_platform.operations.trips_sync import list_office_trips, sync_trips_to_postgres


class TripCatalogHydrateGuardTests(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.data_dir = Path(self._tmpdir.name)
        self._patch = patch.dict("os.environ", {"POREIAGO_DATA_DIR": str(self.data_dir)})
        self._patch.start()
        self.tenant = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

    def tearDown(self):
        self._patch.stop()
        self._tmpdir.cleanup()

    def test_replace_without_prune_preserves_missing_trips(self):
        replace_tenant_catalog(
            self.tenant,
            [
                {"id": 101, "title": "Μετέωρα", "price": 40, "status": "published"},
                {"id": 102, "title": "test1", "price": 10, "status": "published"},
            ],
        )
        with patch(
            "travel_platform.operations.trips_sync.saas_db_available",
            new=AsyncMock(return_value=False),
        ):
            result = asyncio.run(
                sync_trips_to_postgres(
                    [{"id": 102, "title": "test1", "price": 10}],
                    tenant_id=self.tenant,
                    replace_catalog=True,
                    prune_missing=False,
                )
            )
        self.assertGreaterEqual(result.get("catalog_saved", 0), 2)
        titles = {t["title"] for t in list_tenant_trips(self.tenant, published_only=False)}
        self.assertEqual(titles, {"Μετέωρα", "test1"})

    def test_replace_with_prune_allows_delete(self):
        replace_tenant_catalog(
            self.tenant,
            [
                {"id": 201, "title": "Keep", "price": 1, "status": "published"},
                {"id": 202, "title": "Drop", "price": 1, "status": "published"},
            ],
        )
        with patch(
            "travel_platform.operations.trips_sync.saas_db_available",
            new=AsyncMock(return_value=False),
        ):
            asyncio.run(
                sync_trips_to_postgres(
                    [{"id": 201, "title": "Keep", "price": 1}],
                    tenant_id=self.tenant,
                    replace_catalog=True,
                    prune_missing=True,
                )
            )
        rows = list_tenant_trips(self.tenant, published_only=False)
        self.assertEqual([r["id"] for r in rows], [201])

    def test_list_office_trips_returns_catalog(self):
        replace_tenant_catalog(
            self.tenant,
            [{"id": 7, "title": "Ναύπλιο", "price": 35, "status": "draft"}],
        )
        with patch(
            "travel_platform.operations.trips_sync.saas_db_available",
            new=AsyncMock(return_value=False),
        ):
            rows = asyncio.run(list_office_trips(self.tenant))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["title"], "Ναύπλιο")


if __name__ == "__main__":
    unittest.main()
