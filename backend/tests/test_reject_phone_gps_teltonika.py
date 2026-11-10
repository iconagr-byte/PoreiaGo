"""Phone GPS must be rejected for Teltonika-bound plates (no smartphone fallback)."""

from __future__ import annotations

import asyncio
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from travel_platform.telemetry.fleet_ingress import ingest_driver_location
from travel_platform.telemetry.teltonika import device_store as ds


class RejectPhoneGpsTeltonikaTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        path = Path(self.tmp.name) / "devices.json"
        self.patcher = patch.object(ds, "_store_path", return_value=path)
        self.patcher.start()
        self.tenant = "97798681-2f60-4398-b1f6-9eb38dc341b0"
        ds.upsert_device(
            {
                "imei": "861076085468260",
                "vehicle_code": "EEX5670",
                "label": "Λεωφορείο με GPS",
                "enabled": True,
            },
            tenant_id=self.tenant,
        )

    def tearDown(self):
        self.patcher.stop()
        self.tmp.cleanup()

    def test_ingest_soft_acks_phone_gps_for_bound_plate(self):
        """Driver PWA keeps sending; live map is not overwritten by phone GPS."""
        session = {
            "tenant_id": self.tenant,
            "driver_id": "drv-1",
            "driver_name": "Nikos",
            "vehicle_code": "EEX5670",
        }
        body = {
            "lat": 38.25,
            "lng": 20.65,
            "speed": 40,
            "bus_plate": "EEX5670",
        }

        with (
            patch(
                "travel_platform.telemetry.fleet_ingress.process_telemetry_payload",
                new_callable=AsyncMock,
            ) as process,
            patch(
                "travel_platform.settings.drivers_store.get_driver",
                return_value=None,
            ),
            patch(
                "travel_platform.settings.drivers_store.is_seed_driver",
                return_value=False,
            ),
            patch(
                "travel_platform.operations.master_qr_bridge.resolve_platform_tenant_id",
                new_callable=AsyncMock,
                return_value=self.tenant,
            ),
            patch(
                "travel_platform.telemetry.driver_gps_heartbeat.touch_driver_gps",
                return_value=False,
            ) as touch,
        ):
            out = asyncio.run(ingest_driver_location(body, session=session))

        self.assertTrue(out.get("ok"))
        self.assertTrue(out.get("skipped_live_map"))
        self.assertEqual(out.get("map_source"), "teltonika")
        self.assertEqual(out.get("tracker_imei"), "861076085468260")
        process.assert_not_awaited()
        touch.assert_called()

    def test_ingest_allows_phone_gps_for_unbound_plate(self):
        session = {
            "tenant_id": self.tenant,
            "driver_id": "drv-2",
            "driver_name": "Maria",
            "vehicle_code": "FREE123",
        }
        body = {
            "lat": 38.1,
            "lng": 23.7,
            "speed": 10,
            "bus_plate": "FREE123",
        }

        with (
            patch(
                "travel_platform.telemetry.fleet_ingress.process_telemetry_payload",
                new_callable=AsyncMock,
            ) as process,
            patch(
                "travel_platform.settings.drivers_store.get_driver",
                return_value=None,
            ),
            patch(
                "travel_platform.settings.drivers_store.is_seed_driver",
                return_value=False,
            ),
            patch(
                "travel_platform.operations.master_qr_bridge.resolve_platform_tenant_id",
                new_callable=AsyncMock,
                return_value=self.tenant,
            ),
            patch(
                "travel_platform.telemetry.processor.get_live_fleet",
                side_effect=Exception("no fleet"),
            ),
            patch(
                "travel_platform.telemetry.fleet_ingress.publish_fleet_location",
                new_callable=AsyncMock,
            ),
            patch(
                "travel_platform.telemetry.fleet_ws_hub.get_fleet_egress_hub",
                return_value=type("H", (), {"broadcast": AsyncMock()})(),
            ),
            patch(
                "travel_platform.telemetry.fleet_metrics.record_gps_ingress",
                return_value=None,
            ),
            patch(
                "travel_platform.telemetry.driver_gps_heartbeat.touch_driver_gps",
                return_value=False,
            ),
            patch(
                "travel_platform.telemetry.fleet_location_webhook.maybe_dispatch_fleet_location_webhook",
                return_value=None,
            ),
        ):
            out = asyncio.run(ingest_driver_location(body, session=session))

        self.assertNotEqual(out.get("rejected"), True)
        process.assert_awaited()


if __name__ == "__main__":
    unittest.main()
