"""Lost & Found API must be mounted on the production main app."""

from __future__ import annotations

import asyncio
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

import travel_platform.notifications.push_subscription_store as store


class LostItemsMountTests(unittest.TestCase):
    def test_main_app_exposes_lost_items_routes(self) -> None:
        from main import app

        paths = {getattr(r, "path", None) for r in app.routes}
        self.assertIn("/api/customer/lost-items", paths)
        self.assertIn("/api/lost-items", paths)

    def test_report_lost_item_creates_row(self) -> None:
        from ticketing.db import close_ticketing_db, init_ticketing_db
        from ticketing.lost_items import create_lost_item, list_all_lost_items

        async def _run():
            await init_ticketing_db()
            created = await create_lost_item(
                customer_email="iconagr@gmail.com",
                customer_name="Karapataki Maria",
                customer_id="c1",
                item_category="Άλλο",
                description="ψωψωψωψω",
                last_seen_location="ζδσσδ",
            )
            items = await list_all_lost_items()
            await close_ticketing_db()
            return created, items

        created, items = asyncio.run(_run())
        self.assertEqual(created["itemCategory"], "Άλλο")
        self.assertTrue(any(i["id"] == created["id"] for i in items))


class LostItemPushTests(unittest.IsolatedAsyncioTestCase):
    async def test_notify_lost_item_push_uses_admin_subs(self) -> None:
        from travel_platform.notifications.lost_item_push import notify_lost_item_to_office

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
                    result = await notify_lost_item_to_office(
                        {
                            "id": "LF-2001",
                            "customerName": "Maria",
                            "itemCategory": "Άλλο",
                            "description": "ψωψωψωψω",
                            "lastSeenLocation": "ζδσσδ",
                        }
                    )
                self.assertTrue(result.get("ok"))
                self.assertGreaterEqual(send.await_count, 1)
                payload = send.await_args.args[1]
                self.assertEqual(payload["data"]["type"], "lost_item_report")
                self.assertIn("lost_found", payload["url"])


if __name__ == "__main__":
    unittest.main()
