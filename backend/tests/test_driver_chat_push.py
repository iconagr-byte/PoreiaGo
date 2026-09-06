"""Web Push on office ↔ driver chat messages."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

import travel_platform.notifications.push_subscription_store as store


class DriverChatPushTests(unittest.IsolatedAsyncioTestCase):
    async def test_office_to_driver_sends_exact_driver_only(self) -> None:
        from travel_platform.notifications.driver_chat_push import notify_office_message_to_driver

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "push_subscriptions.json"
            with patch.object(store, "_STORE_FILE", path):
                store.upsert_subscription(
                    email="driver:a@t1",
                    endpoint="https://push.example/a",
                    keys={"p256dh": "a", "auth": "b"},
                    tenant_id="t1",
                    audience="driver",
                    driver_id="drv-a",
                )
                store.upsert_subscription(
                    email="driver:b@t1",
                    endpoint="https://push.example/b",
                    keys={"p256dh": "a", "auth": "b"},
                    tenant_id="t1",
                    audience="driver",
                    driver_id="drv-b",
                )
                send = AsyncMock(return_value={"sent": True})
                with (
                    patch(
                        "travel_platform.notifications.web_push_service.web_push_configured",
                        return_value=True,
                    ),
                    patch(
                        "travel_platform.notifications.web_push_service.ensure_web_push_keys",
                        return_value=True,
                    ),
                    patch(
                        "travel_platform.notifications.web_push_service.send_push_to_subscription",
                        new=send,
                    ),
                ):
                    result = await notify_office_message_to_driver(
                        tenant_id="t1",
                        driver_id="drv-a",
                        body="Έλα στο λιμάνι στις 10",
                        sender_name="Γραφείο",
                    )
                self.assertTrue(result.get("ok"))
                self.assertEqual(result.get("sent"), 1)
                self.assertEqual(send.await_count, 1)
                payload = send.await_args.args[1]
                self.assertEqual(payload["data"]["type"], "driver_office_chat")
                self.assertIn("Έλα στο λιμάνι", payload["body"])
                self.assertEqual(payload["url"], "/driver?tab=chat")

    async def test_driver_to_office_fans_out_admin_subs(self) -> None:
        from travel_platform.notifications.driver_chat_push import notify_driver_message_to_office

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "push_subscriptions.json"
            with patch.object(store, "_STORE_FILE", path):
                store.upsert_subscription(
                    email="office@example.com",
                    endpoint="https://push.example/admin",
                    keys={"p256dh": "a", "auth": "b"},
                    tenant_id="t1",
                    audience="admin",
                )
                send = AsyncMock(return_value={"sent": True})
                with (
                    patch(
                        "travel_platform.notifications.web_push_service.web_push_configured",
                        return_value=True,
                    ),
                    patch(
                        "travel_platform.notifications.web_push_service.ensure_web_push_keys",
                        return_value=True,
                    ),
                    patch(
                        "travel_platform.notifications.web_push_service.send_push_to_subscription",
                        new=send,
                    ),
                ):
                    result = await notify_driver_message_to_office(
                        tenant_id="t1",
                        driver_id="drv-1",
                        body="Έφτασα στο σημείο",
                        sender_name="Νίκος",
                    )
                self.assertTrue(result.get("ok"))
                self.assertEqual(result.get("sent"), 1)
                payload = send.await_args.args[1]
                self.assertEqual(payload["title"], "Μήνυμα από Νίκος")
                self.assertIn("driver_chat", payload["url"])
                self.assertIn("drv-1", payload["url"])

    async def test_office_to_driver_skips_without_subs(self) -> None:
        from travel_platform.notifications.driver_chat_push import notify_office_message_to_driver

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "push_subscriptions.json"
            with patch.object(store, "_STORE_FILE", path):
                with (
                    patch(
                        "travel_platform.notifications.web_push_service.web_push_configured",
                        return_value=True,
                    ),
                    patch(
                        "travel_platform.notifications.web_push_service.ensure_web_push_keys",
                        return_value=True,
                    ),
                ):
                    result = await notify_office_message_to_driver(
                        tenant_id="t1",
                        driver_id="missing",
                        body="hello",
                    )
                self.assertTrue(result.get("skipped"))
                self.assertEqual(result.get("reason"), "no_driver_subscriptions")


if __name__ == "__main__":
    unittest.main()
