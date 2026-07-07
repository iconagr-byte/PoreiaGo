"""Tests for driver shift invite push."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

import travel_platform.notifications.push_subscription_store as store


class DriverPushStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "push_subscriptions.json"
        self._patch = patch.object(store, "_STORE_FILE", self.path)
        self._patch.start()

    def tearDown(self) -> None:
        self._patch.stop()
        self.tmp.cleanup()

    def test_list_subscriptions_for_driver_filters_by_driver_id(self) -> None:
        store.upsert_subscription(
            email="driver:a@t1",
            endpoint="https://push.example/a",
            keys={"p256dh": "a", "auth": "b"},
            tenant_id="t1",
            audience="driver",
            driver_id="driver-a",
        )
        store.upsert_subscription(
            email="driver:b@t1",
            endpoint="https://push.example/b",
            keys={"p256dh": "a", "auth": "b"},
            tenant_id="t1",
            audience="driver",
            driver_id="driver-b",
        )
        subs = store.list_subscriptions_for_driver("t1", "driver-a")
        self.assertEqual(len(subs), 1)
        self.assertEqual(subs[0]["driver_id"], "driver-a")


class DriverShiftInvitePushTests(unittest.IsolatedAsyncioTestCase):
    async def test_send_skips_without_vapid(self) -> None:
        from travel_platform.notifications.driver_push_service import send_driver_shift_invite_push

        with patch(
            "travel_platform.notifications.driver_push_service.web_push_configured",
            return_value=False,
        ):
            result = await send_driver_shift_invite_push(
                tenant_id="t1",
                trip_id=1,
                auth_url="https://www.poreiago.com/driver/auth?token=abc",
            )
        self.assertTrue(result.get("skipped"))

    async def test_send_to_driver_subscription(self) -> None:
        from travel_platform.notifications.driver_push_service import send_driver_shift_invite_push

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "push_subscriptions.json"
            with patch.object(store, "_STORE_FILE", path):
                store.upsert_subscription(
                    email="driver:x@t1",
                    endpoint="https://push.example/x",
                    keys={"p256dh": "a", "auth": "b"},
                    tenant_id="t1",
                    audience="driver",
                    driver_id="drv-1",
                )
                with patch(
                    "travel_platform.notifications.driver_push_service.web_push_configured",
                    return_value=True,
                ), patch(
                    "travel_platform.notifications.driver_push_service.send_push_to_subscription",
                    new_callable=AsyncMock,
                    return_value={"sent": True},
                ):
                    result = await send_driver_shift_invite_push(
                        tenant_id="t1",
                        trip_id=9,
                        driver_id="drv-1",
                        auth_url="https://www.poreiago.com/driver/auth?token=abc",
                    )
                self.assertTrue(result.get("ok"))
                self.assertEqual(result.get("sent"), 1)


if __name__ == "__main__":
    unittest.main()
