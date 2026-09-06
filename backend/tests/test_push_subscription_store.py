"""Tests for customer Web Push subscription store."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import travel_platform.notifications.push_subscription_store as store


class PushSubscriptionStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "push_subscriptions.json"
        self._patch = patch.object(store, "_STORE_FILE", self.path)
        self._patch.start()

    def tearDown(self) -> None:
        self._patch.stop()
        self.tmp.cleanup()

    def test_upsert_and_list_by_email(self) -> None:
        row = store.upsert_subscription(
            email="User@Example.com",
            endpoint="https://push.example/1",
            keys={"p256dh": "abc", "auth": "def"},
        )
        self.assertTrue(row["id"])
        subs = store.list_subscriptions_for_email("user@example.com")
        self.assertEqual(len(subs), 1)
        self.assertEqual(subs[0]["endpoint"], "https://push.example/1")

    def test_delete_subscription(self) -> None:
        store.upsert_subscription(
            email="a@b.com",
            endpoint="https://push.example/1",
            keys={"p256dh": "abc", "auth": "def"},
        )
        removed = store.delete_subscription(email="a@b.com", endpoint="https://push.example/1")
        self.assertTrue(removed)
        self.assertEqual(store.list_subscriptions_for_email("a@b.com"), [])

    def test_list_all_admin_and_audience_filter(self) -> None:
        store.upsert_subscription(
            email="admin@ex.com",
            endpoint="https://push.example/admin",
            keys={"p256dh": "a", "auth": "b"},
            tenant_id="t1",
            audience="admin",
        )
        store.upsert_subscription(
            email="admin@ex.com",
            endpoint="https://push.example/cust",
            keys={"p256dh": "c", "auth": "d"},
            tenant_id="t1",
            audience="customer",
        )
        admins = store.list_all_subscriptions(audience="admin")
        self.assertEqual(len(admins), 1)
        email_admins = store.list_subscriptions_for_email("admin@ex.com", audience="admin")
        self.assertEqual(len(email_admins), 1)

    def test_migrates_legacy_package_file(self) -> None:
        data_dir = Path(self.tmp.name) / "data"
        legacy = Path(self.tmp.name) / "legacy_push.json"
        legacy.write_text(
            json.dumps(
                {
                    "subscriptions": [
                        {
                            "id": "legacy1",
                            "email": "a@b.com",
                            "endpoint": "https://push.example/legacy",
                            "keys": {"p256dh": "x", "auth": "y"},
                            "audience": "admin",
                            "tenant_id": "t1",
                        }
                    ]
                }
            ),
            encoding="utf-8",
        )
        self._patch.stop()
        with (
            patch.object(store, "_STORE_FILE", None),
            patch.object(store, "_LEGACY_STORE_FILE", legacy),
            patch.dict("os.environ", {"POREIAGO_DATA_DIR": str(data_dir)}, clear=False),
        ):
            rows = store.list_all_subscriptions(audience="admin")
            self.assertEqual(len(rows), 1)
            self.assertTrue((data_dir / "push_subscriptions.json").is_file())
        self._patch = patch.object(store, "_STORE_FILE", self.path)
        self._patch.start()


if __name__ == "__main__":
    unittest.main()
