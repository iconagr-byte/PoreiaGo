"""Office bell + push for paid excursion (Wallet) bookings."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch


class ExcursionBookingPushTests(unittest.IsolatedAsyncioTestCase):
    async def test_notify_creates_new_booking_alert_and_attempts_push(self):
        from travel_platform.notifications.excursion_booking_push import (
            notify_excursion_booking_to_office,
        )

        alert_row = {
            "id": "alert-1",
            "alert_type": "NEW_BOOKING",
            "created_at": "2026-10-24T10:00:00+00:00",
        }

        with (
            patch(
                "travel_platform.telemetry.alerts.TelemetryAlertBus.push_generic",
                return_value=alert_row,
            ) as push_generic,
            patch(
                "travel_platform.telemetry.fleet_pubsub.publish_fleet_alert",
                new_callable=AsyncMock,
            ),
            patch(
                "travel_platform.notifications.web_push_service.ensure_web_push_keys",
            ),
            patch(
                "travel_platform.notifications.web_push_service.web_push_configured",
                return_value=True,
            ),
            patch(
                "travel_platform.notifications.push_subscription_store.list_subscriptions_for_tenant",
                return_value=[],
            ),
            patch(
                "travel_platform.notifications.push_subscription_store.list_all_subscriptions",
                return_value=[
                    {"endpoint": "https://push.example/1", "keys": {"p256dh": "x", "auth": "y"}},
                ],
            ),
            patch(
                "travel_platform.notifications.push_subscription_store.list_subscriptions_for_email",
                return_value=[],
            ),
            patch(
                "travel_platform.notifications.web_push_service.send_push_to_subscription",
                new_callable=AsyncMock,
                return_value={"sent": True},
            ) as send_sub,
            patch(
                "travel_platform.notifications.excursion_booking_push._admin_email",
                return_value="",
            ),
        ):
            result = await notify_excursion_booking_to_office(
                {
                    "id": "bk-1",
                    "pnr": "BK-TEST01",
                    "tenant_id": "tenant-achillio",
                    "passenger_name": "Μαρία",
                    "trip_title": "Ημερήσιο στο Μετέωρα",
                    "seat_label": "1A",
                    "amount_paid": 53.44,
                }
            )

        push_generic.assert_called_once()
        kwargs = push_generic.call_args.kwargs
        self.assertEqual(kwargs["alert_type"], "NEW_BOOKING")
        self.assertEqual(kwargs["tenant_id"], "tenant-achillio")
        self.assertIn("Μετέωρα", kwargs["message"])
        send_sub.assert_awaited()
        self.assertTrue(result.get("ok"))
        self.assertEqual(result.get("alert_id"), "alert-1")
        self.assertEqual(result.get("sent"), 1)


if __name__ == "__main__":
    unittest.main()
