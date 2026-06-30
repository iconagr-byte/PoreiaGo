"""Tests for customer Web Push subscription store."""

from __future__ import annotations

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


if __name__ == "__main__":
    unittest.main()
