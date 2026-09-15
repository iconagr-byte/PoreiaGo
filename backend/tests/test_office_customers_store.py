"""Office CRM customers persist across list/upsert/delete."""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class OfficeCustomersStoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store_path = Path(self.tmp.name) / "office_customers.json"
        self.patcher = patch(
            "travel_platform.settings.office_customers_store.STORE_FILE",
            self.store_path,
        )
        self.patcher.start()
        # Re-import bindings after patch target exists
        from travel_platform.settings import office_customers_store as store

        self.store = store

    def tearDown(self):
        self.patcher.stop()
        self.tmp.cleanup()

    def test_upsert_list_delete(self):
        row = self.store.upsert_customer(
            "tenant-a",
            {
                "name": "Νίκος",
                "email": "nikos@example.com",
                "phone": "6900000001",
                "city": "Θεσσαλονίκη",
                "tier": "Gold",
                "serviceScope": "buses",
            },
        )
        self.assertEqual(row["email"], "nikos@example.com")
        listed = self.store.list_customers("tenant-a", service_scope="buses")
        self.assertEqual(len(listed), 1)
        self.assertEqual(listed[0]["city"], "Θεσσαλονίκη")
        # Other tenant isolated
        self.assertEqual(self.store.list_customers("tenant-b"), [])
        self.assertTrue(self.store.delete_customer("tenant-a", row["id"]))
        self.assertEqual(self.store.list_customers("tenant-a"), [])

    def test_replace_seeds_and_scopes(self):
        self.store.replace_customers_for_tenant(
            "tenant-a",
            [
                {"name": "A", "email": "a@x.com", "serviceScope": "buses"},
                {"name": "B", "email": "b@x.com", "serviceScope": "rent"},
            ],
        )
        buses = self.store.list_customers("tenant-a", service_scope="buses")
        rent = self.store.list_customers("tenant-a", service_scope="rent")
        self.assertEqual([c["email"] for c in buses], ["a@x.com"])
        self.assertEqual([c["email"] for c in rent], ["b@x.com"])


if __name__ == "__main__":
    unittest.main()
