"""Abandoned carts must not leak across Achillio Travel and PoreiaGo."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from travel_platform.revenue import abandoned_carts as ac


class AbandonedCartTenantScopeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "abandoned_carts.json"
        self.patcher = patch.object(ac, "STORE_PATH", self.path)
        self.patcher.start()
        self.data_patcher = patch.object(ac, "DATA_DIR", Path(self.tmp.name))
        self.data_patcher.start()

    def tearDown(self):
        self.patcher.stop()
        self.data_patcher.stop()
        self.tmp.cleanup()

    def test_list_filters_by_tenant(self):
        ac.upsert_cart(
            trip_id=1,
            trip_title="Achillio trip",
            seats="1",
            amount_eur=10,
            tenant_id="tenant-achillio",
        )
        ac.upsert_cart(
            trip_id=2,
            trip_title="PoreiaGo trip",
            seats="2",
            amount_eur=20,
            tenant_id="tenant-poreiago",
        )
        ach = ac.list_carts(tenant_id="tenant-achillio")
        por = ac.list_carts(tenant_id="tenant-poreiago")
        self.assertEqual(len(ach), 1)
        self.assertEqual(ach[0].trip_title, "Achillio trip")
        self.assertEqual(len(por), 1)
        self.assertEqual(por[0].trip_title, "PoreiaGo trip")

    def test_legacy_rows_without_tenant_hidden_when_scoped(self):
        carts = [
            {
                "id": "AC-LEGACY",
                "resume_token": "tok",
                "trip_id": 1,
                "trip_title": "Legacy",
                "seats": "1",
                "amount_eur": 5,
                "passenger_name": "",
                "passenger_email": "a@b.com",
                "passenger_phone": "",
                "created_at": "2026-01-01T00:00:00+00:00",
                "updated_at": "2026-01-01T00:00:00+00:00",
            }
        ]
        ac._save(carts)
        self.assertEqual(ac.list_carts(tenant_id="tenant-x"), [])


if __name__ == "__main__":
    unittest.main()
