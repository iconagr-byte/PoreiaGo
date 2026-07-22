"""Driver shift online/offline — tracker & notifications."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

from travel_platform.telemetry.alerts import TelemetryAlertBus
from travel_platform.telemetry.driver_shift_tracker import (
    driver_connection_key,
    on_driver_connected,
    on_driver_disconnected,
)


class DriverShiftTrackerTests(unittest.TestCase):
    def setUp(self):
        TelemetryAlertBus._recent.clear()

    def test_connection_key_includes_tenant_driver_trip(self):
        session = {"tenant_id": "t1", "sub": "d1", "trip_id": 9}
        self.assertEqual(driver_connection_key(session), "t1:d1:9")

    def test_online_only_on_first_connection(self):
        session = {"tenant_id": "t1", "sub": "d1", "trip_id": 1}
        self.assertTrue(on_driver_connected(session, 101))
        self.assertFalse(on_driver_connected(session, 102))

    def test_offline_only_when_last_disconnects(self):
        session = {"tenant_id": "t1", "sub": "d1", "trip_id": 1}
        on_driver_connected(session, 101)
        on_driver_connected(session, 102)
        self.assertFalse(on_driver_disconnected(session, 101))
        self.assertTrue(on_driver_disconnected(session, 102))


class DriverShiftNotificationTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        TelemetryAlertBus._recent.clear()

    async def test_notify_online_creates_alert(self):
        from travel_platform.telemetry.driver_shift_notifications import notify_driver_shift

        session = {
            "tenant_id": "00000000-0000-0000-0000-000000000001",
            "sub": "drv-1",
            "trip_id": 5,
            "driver_name": "Nikos",
            "vehicle_code": "XAH-1",
        }

        with (
            patch(
                "travel_platform.telemetry.driver_shift_notifications._send_driver_shift_push",
                new_callable=AsyncMock,
                return_value={"sent": 0},
            ),
            patch(
                "travel_platform.telemetry.fleet_pubsub.publish_fleet_alert",
                new_callable=AsyncMock,
                return_value=True,
            ) as publish,
        ):
            result = await notify_driver_shift(
                "online",
                session,
                body={"reason": "shift_start"},
            )

        self.assertIn("alert_id", result)
        publish.assert_awaited()
        alerts = TelemetryAlertBus.list_recent(session["tenant_id"], limit=5)
        self.assertEqual(alerts[0]["alert_type"], "DRIVER_ONLINE")
        self.assertIn("Nikos", alerts[0]["message"])
        self.assertIn("ξεκίνησε τη βάρδια", alerts[0]["message"])

    async def test_push_reports_no_subscriptions(self):
        from travel_platform.telemetry.driver_shift_notifications import _send_driver_shift_push

        with (
            patch(
                "travel_platform.notifications.web_push_service.ensure_web_push_keys",
                return_value=True,
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
                return_value=[],
            ),
            patch(
                "travel_platform.notifications.push_subscription_store.list_subscriptions_for_email",
                return_value=[],
            ),
            patch(
                "travel_platform.telemetry.driver_shift_notifications._admin_email",
                return_value="",
            ),
        ):
            result = await _send_driver_shift_push(
                event="online",
                meta={
                    "tenant_id": "t1",
                    "driver_id": "d1",
                    "driver_name": "Nikos",
                    "bus_plate": "XAH",
                    "trip_id": 1,
                },
                message="test",
            )
        self.assertEqual(result.get("reason"), "no_admin_subscriptions")
        self.assertEqual(result.get("sent"), 0)

    async def test_notify_offline_skipped_when_disabled(self):
        from travel_platform.telemetry.driver_shift_notifications import notify_driver_shift

        session = {"tenant_id": "t1", "sub": "d1", "trip_id": 1}
        with patch(
            "travel_platform.telemetry.driver_shift_notifications._shift_settings",
            return_value={"notify_admin": False, "notify_push": False},
        ):
            result = await notify_driver_shift("offline", session)
        self.assertTrue(result.get("skipped"))

if __name__ == "__main__":
    unittest.main()
