"""Tests for fleet digest notifications."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

from travel_platform.telemetry.fleet_digest_notifications import (
    build_fleet_digest_email_subject,
    build_fleet_digest_sms,
    send_fleet_digest_notifications,
)


class FleetDigestNotificationTests(unittest.TestCase):
    def test_build_sms_contains_km_and_alerts(self) -> None:
        msg = build_fleet_digest_sms(
            {
                "tenant_id": "00000000-0000-0000-0000-000000000099",
                "digest_period_days": 1,
                "summary": {
                    "total_distance_km": 128.4,
                    "drivers_with_gps": 3,
                    "alerts_total": 5,
                    "alerts_route_deviation": 2,
                    "active_drivers_now": 1,
                },
            },
        )
        self.assertIn("128", msg)
        self.assertIn("5 alerts", msg)

    def test_email_subject(self) -> None:
        subject = build_fleet_digest_email_subject(
            {"tenant_id": "00000000-0000-0000-0000-000000000099", "digest_period_days": 1},
        )
        self.assertIn("Fleet digest", subject)


class FleetDigestSendTests(unittest.IsolatedAsyncioTestCase):
    async def test_send_skipped_when_disabled(self) -> None:
        digest = {"tenant_id": "tenant-1", "summary": {}, "digest_period_days": 1}
        with (
            patch(
                "travel_platform.telemetry.fleet_digest_service.fleet_digest_settings",
                return_value={"enabled": False},
            ),
            patch(
                "travel_platform.telemetry.settings_store.get_telemetry_settings",
                return_value=__import__(
                    "travel_platform.telemetry.settings_store",
                    fromlist=["TelemetryRuntimeSettings"],
                ).TelemetryRuntimeSettings(),
            ),
        ):
            result = await send_fleet_digest_notifications(digest)
        self.assertTrue(result["skipped"])

    async def test_send_email_when_configured(self) -> None:
        digest = {
            "tenant_id": "tenant-1",
            "summary": {"total_distance_km": 10, "drivers_with_gps": 1, "alerts_total": 0, "active_drivers_now": 0},
            "digest_period_days": 1,
            "top_trips": [],
            "alerts_by_type": {},
        }
        with (
            patch(
                "travel_platform.telemetry.fleet_digest_service.fleet_digest_settings",
                return_value={"enabled": True},
            ),
            patch(
                "travel_platform.telemetry.fleet_digest_service.admin_recipients",
                return_value={"email": "ops@test.com", "phone": ""},
            ),
            patch(
                "travel_platform.telemetry.settings_store.get_telemetry_settings",
            ) as settings,
            patch("travel_platform.notifications.dispatcher.send_email", new=AsyncMock(return_value="msg-1")),
        ):
            from travel_platform.telemetry.settings_store import TelemetryRuntimeSettings

            settings.return_value = TelemetryRuntimeSettings(
                fleet_digest_enabled=True,
                fleet_digest_email_enabled=True,
                fleet_digest_sms_enabled=False,
            )
            result = await send_fleet_digest_notifications(digest)
        self.assertIn("email", result)
        self.assertEqual(result["email"]["to"], "ops@test.com")


if __name__ == "__main__":
    unittest.main()
