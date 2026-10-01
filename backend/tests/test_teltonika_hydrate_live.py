"""Hydrate live fleet pins from Teltonika device-store last fixes."""

from __future__ import annotations

import asyncio
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

from travel_platform.telemetry.live_fleet import LiveFleetService
from travel_platform.telemetry.teltonika import device_store as ds
from travel_platform.telemetry.teltonika.hydrate_live import hydrate_tenant_live_from_devices


class TeltonikaHydrateLiveTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        path = Path(self.tmp.name) / "devices.json"
        self.patcher = patch.object(ds, "_store_path", return_value=path)
        self.patcher.start()
        self.tenant = "97798681-2f60-4398-b1f6-9eb38dc341b0"
        LiveFleetService._vehicles = {}
        LiveFleetService._code_index = {}
        # Reset throttle between tests.
        from travel_platform.telemetry.teltonika import hydrate_live as hl

        hl._last_hydrate_at.clear()
        ds.upsert_device(
            {
                "imei": "861076085468260",
                "vehicle_code": "EEX5670",
                "label": "Λεωφορείο με GPS",
                "enabled": True,
            },
            tenant_id=self.tenant,
        )
        ds.touch_device("861076085468260", lat=38.25, lng=20.65, speed_kmh=12, points=1)

    def tearDown(self):
        self.patcher.stop()
        self.tmp.cleanup()

    def test_hydrates_when_live_fleet_empty(self):
        with patch(
            "travel_platform.telemetry.processor.process_telemetry_payload",
            new_callable=AsyncMock,
        ) as process:
            n = asyncio.run(hydrate_tenant_live_from_devices(self.tenant))

        self.assertEqual(n, 1)
        process.assert_awaited()
        payload = process.await_args.args[0]
        self.assertEqual(payload["source"], "teltonika")
        self.assertEqual(payload["vehicle_code"], "EEX5670")
        # Fresh last_seen from setUp → open channel (not parked hydrate).
        self.assertFalse(payload.get("hydrated_from_store"))
        self.assertAlmostEqual(float(payload["latitude"]), 38.25, places=4)

    def test_skips_when_live_teltonika_pin_fresh(self):
        vid = "veh-1"
        LiveFleetService._code_index[f"{self.tenant}:EEX5670"] = vid
        LiveFleetService._vehicles[vid] = {
            "vehicle_id": vid,
            "tenant_id": self.tenant,
            "vehicle_code": "EEX5670",
            "lat": 38.25,
            "lng": 20.65,
            "source": "teltonika",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "tracker_signal_at": datetime.now(timezone.utc).isoformat(),
        }
        with patch(
            "travel_platform.telemetry.processor.process_telemetry_payload",
            new_callable=AsyncMock,
        ) as process:
            n = asyncio.run(hydrate_tenant_live_from_devices(self.tenant))

        self.assertEqual(n, 0)
        process.assert_not_awaited()

    def test_online_tracker_takes_over_app_pin(self):
        """Open Teltonika must appear on the map even when App GPS is already there."""
        vid = "veh-app"
        LiveFleetService._code_index[f"{self.tenant}:EEX5670"] = vid
        LiveFleetService._vehicles[vid] = {
            "vehicle_id": vid,
            "tenant_id": self.tenant,
            "vehicle_code": "EEX5670",
            "lat": 38.25,
            "lng": 20.65,
            "source": "driver_pwa",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        with patch(
            "travel_platform.telemetry.processor.process_telemetry_payload",
            new_callable=AsyncMock,
        ) as process:
            n = asyncio.run(hydrate_tenant_live_from_devices(self.tenant))

        self.assertEqual(n, 1)
        process.assert_awaited()
        payload = process.await_args.args[0]
        self.assertEqual(payload["source"], "teltonika")
        self.assertFalse(payload.get("hydrated_from_store"))

    def test_skips_closed_tracker_over_app_pin(self):
        """Parked/closed Teltonika must not overwrite a live App pin."""
        # Age the device last_seen so it is closed for soft-ack window.
        with ds._LOCK:  # noqa: SLF001
            data = ds._read()  # noqa: SLF001
            for row in data.get("devices") or []:
                if row.get("imei") == "861076085468260":
                    row["last_seen_at"] = (
                        datetime.now(timezone.utc) - timedelta(hours=2)
                    ).isoformat()
            ds._write(data)  # noqa: SLF001

        vid = "veh-app"
        LiveFleetService._code_index[f"{self.tenant}:EEX5670"] = vid
        LiveFleetService._vehicles[vid] = {
            "vehicle_id": vid,
            "tenant_id": self.tenant,
            "vehicle_code": "EEX5670",
            "lat": 38.25,
            "lng": 20.65,
            "source": "driver_pwa",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        with patch(
            "travel_platform.telemetry.processor.process_telemetry_payload",
            new_callable=AsyncMock,
        ) as process:
            n = asyncio.run(hydrate_tenant_live_from_devices(self.tenant))

        self.assertEqual(n, 0)
        process.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
