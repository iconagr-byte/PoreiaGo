"""Tests for fleet.location partner webhooks."""

from __future__ import annotations

import unittest
from unittest.mock import patch
from uuid import uuid4

from travel_platform.telemetry.fleet_location_webhook import (
    FLEET_LOCATION_EVENT,
    build_fleet_location_webhook_payload,
    dispatch_fleet_location_webhook,
    reset_fleet_webhook_throttle,
    should_dispatch_fleet_webhook,
)


class FleetLocationWebhookTests(unittest.TestCase):
    def setUp(self) -> None:
        reset_fleet_webhook_throttle()

    def tearDown(self) -> None:
        reset_fleet_webhook_throttle()

    def test_build_payload_from_egress(self) -> None:
        egress = {
            "type": "fleet_location",
            "tenant_id": "tenant-1",
            "trip_id": 42,
            "driver_id": "drv-1",
            "driver_name": "Nikos",
            "vehicle_id": "veh-1",
            "vehicle_code": "XAH-4021",
            "bus_plate": "XAH-4021",
            "lat": 37.98,
            "lng": 23.73,
            "speed": 55.0,
            "heading": 180.0,
            "timestamp": "2026-06-09T10:00:00+00:00",
        }
        payload = build_fleet_location_webhook_payload(egress)
        self.assertEqual(payload["tenant_id"], "tenant-1")
        self.assertEqual(payload["trip_id"], 42)
        self.assertEqual(payload["speed_kmh"], 55.0)
        self.assertEqual(payload["source"], "driver_pwa")

    def test_throttle_blocks_rapid_dispatches(self) -> None:
        egress = {"tenant_id": "t1", "driver_id": "d1", "trip_id": 1}
        self.assertTrue(should_dispatch_fleet_webhook(egress, min_interval_sec=30))
        self.assertFalse(should_dispatch_fleet_webhook(egress, min_interval_sec=30))

    def test_dispatch_skipped_when_disabled(self) -> None:
        from travel_platform.telemetry.settings_store import update_telemetry_settings

        tid = str(uuid4())
        update_telemetry_settings(
            {"fleet_webhook_enabled": False},
            tenant_id=tid,
        )
        with patch("app.services.payment_dispatch.dispatch_partner_webhook") as dispatch:
            result = dispatch_fleet_location_webhook(
                tid,
                {"tenant_id": tid, "driver_id": "d1", "trip_id": 1, "lat": 1, "lng": 2},
            )
        dispatch.assert_not_called()
        self.assertEqual(result["reason"], "disabled")

    def test_dispatch_queues_event(self) -> None:
        from travel_platform.telemetry.settings_store import update_telemetry_settings

        tid = str(uuid4())
        update_telemetry_settings(
            {"fleet_webhook_enabled": True, "fleet_webhook_min_interval_sec": 0},
            tenant_id=tid,
        )
        egress = {
            "tenant_id": tid,
            "trip_id": 9,
            "driver_id": "drv",
            "lat": 38.0,
            "lng": 23.0,
            "speed": 40,
            "timestamp": "2026-06-09T10:00:00+00:00",
        }
        with patch("app.services.payment_dispatch.dispatch_partner_webhook") as dispatch:
            result = dispatch_fleet_location_webhook(tid, egress)
        dispatch.assert_called_once()
        args = dispatch.call_args.args
        self.assertEqual(args[0], tid)
        self.assertEqual(args[1], FLEET_LOCATION_EVENT)
        self.assertEqual(args[2]["trip_id"], 9)
        self.assertTrue(result["queued"])


if __name__ == "__main__":
    unittest.main()
