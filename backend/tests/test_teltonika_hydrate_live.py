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
            "travel_platform.telemetry.teltonika.paint_live.process_telemetry_payload",
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
            "travel_platform.telemetry.teltonika.paint_live.process_telemetry_payload",
            new_callable=AsyncMock,
        ) as process:
            n = asyncio.run(hydrate_tenant_live_from_devices(self.tenant))

        self.assertEqual(n, 0)
        process.assert_not_awaited()

    def test_refreshes_aging_online_pin(self):
        """Online device must re-stamp before list_active drops the pin (90s)."""
        vid = "veh-1"
        aged = (datetime.now(timezone.utc) - timedelta(seconds=50)).isoformat()
        LiveFleetService._code_index[f"{self.tenant}:EEX5670"] = vid
        LiveFleetService._vehicles[vid] = {
            "vehicle_id": vid,
            "tenant_id": self.tenant,
            "vehicle_code": "EEX5670",
            "lat": 38.25,
            "lng": 20.65,
            "source": "teltonika",
            "updated_at": aged,
            "tracker_signal_at": aged,
        }
        with patch(
            "travel_platform.telemetry.teltonika.paint_live.process_telemetry_payload",
            new_callable=AsyncMock,
        ) as process:
            n = asyncio.run(hydrate_tenant_live_from_devices(self.tenant))

        self.assertEqual(n, 1)
        process.assert_awaited()

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
            "travel_platform.telemetry.teltonika.paint_live.process_telemetry_payload",
            new_callable=AsyncMock,
        ) as process:
            n = asyncio.run(hydrate_tenant_live_from_devices(self.tenant))

        self.assertEqual(n, 1)
        process.assert_awaited()
        payload = process.await_args.args[0]
        self.assertEqual(payload["source"], "teltonika")
        self.assertFalse(payload.get("hydrated_from_store"))

    def test_stale_tracker_does_not_fight_live_app(self):
        """Quiet hardware must not yank a live App pin (stops App↔GPS jump)."""
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
            "travel_platform.telemetry.teltonika.paint_live.process_telemetry_payload",
            new_callable=AsyncMock,
        ) as process:
            n = asyncio.run(hydrate_tenant_live_from_devices(self.tenant))

        self.assertEqual(n, 0)
        process.assert_not_awaited()
        self.assertEqual(LiveFleetService._vehicles[vid].get("source"), "driver_pwa")

    def test_online_tracker_reclaims_app_pin(self):
        """Online IMEI reclaim App pin so dual-live position stays on hardware."""
        ds.touch_device("861076085468260", lat=40.8, lng=22.05, speed_kmh=0, points=1)
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
            "travel_platform.telemetry.teltonika.paint_live.process_telemetry_payload",
            new_callable=AsyncMock,
        ) as process:
            n = asyncio.run(hydrate_tenant_live_from_devices(self.tenant))

        self.assertEqual(n, 1)
        process.assert_awaited()
        payload = process.await_args.args[0]
        self.assertEqual(payload["source"], "teltonika")
        self.assertFalse(payload.get("hydrated_from_store"))

    def test_keeps_enabled_stale_hardware_pin(self):
        """Safety watch: enabled IMEI last-known is re-stamped, never age-dropped."""
        with ds._LOCK:  # noqa: SLF001
            data = ds._read()  # noqa: SLF001
            for row in data.get("devices") or []:
                if row.get("imei") == "861076085468260":
                    row["last_seen_at"] = (
                        datetime.now(timezone.utc) - timedelta(hours=2)
                    ).isoformat()
            ds._write(data)  # noqa: SLF001

        vid = "veh-hw"
        LiveFleetService._code_index[f"{self.tenant}:EEX5670"] = vid
        LiveFleetService._vehicles[vid] = {
            "vehicle_id": vid,
            "tenant_id": self.tenant,
            "vehicle_code": "EEX5670",
            "lat": 38.25,
            "lng": 20.65,
            "source": "teltonika",
            "updated_at": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
            "tracker_signal_at": (
                datetime.now(timezone.utc) - timedelta(hours=2)
            ).isoformat(),
        }
        with patch(
            "travel_platform.telemetry.teltonika.paint_live.process_telemetry_payload",
            new_callable=AsyncMock,
        ) as process, patch(
            "travel_platform.telemetry.live_fleet_redis.delete_live_vehicle",
            new_callable=AsyncMock,
        ) as delete_mock:
            n = asyncio.run(hydrate_tenant_live_from_devices(self.tenant))

        self.assertEqual(n, 1)
        process.assert_awaited()
        delete_mock.assert_not_awaited()

    def test_force_repaints_online_when_map_empty(self):
        """Empty Achillio map + online IMEI → force hydrate paints immediately."""
        from travel_platform.telemetry.teltonika import hydrate_live as hl

        hl._last_hydrate_at[self.tenant] = __import__("time").monotonic()
        with patch(
            "travel_platform.telemetry.teltonika.paint_live.process_telemetry_payload",
            new_callable=AsyncMock,
        ) as process:
            n = asyncio.run(hydrate_tenant_live_from_devices(self.tenant, force=True))

        self.assertEqual(n, 1)
        process.assert_awaited()

    def test_keeps_parked_pin_continuous_watch(self):
        """Sparse AVL (e.g. 0 km/h) — last fix stays on the map for safety."""
        with ds._LOCK:  # noqa: SLF001
            data = ds._read()  # noqa: SLF001
            for row in data.get("devices") or []:
                if row.get("imei") == "861076085468260":
                    row["last_seen_at"] = (
                        datetime.now(timezone.utc) - timedelta(minutes=5)
                    ).isoformat()
            ds._write(data)  # noqa: SLF001

        with patch(
            "travel_platform.telemetry.teltonika.paint_live.process_telemetry_payload",
            new_callable=AsyncMock,
        ) as process:
            n = asyncio.run(hydrate_tenant_live_from_devices(self.tenant))

        self.assertEqual(n, 1)
        process.assert_awaited()
        payload = process.await_args.args[0]
        # Not «online» badge channel — last-known parked pin.
        self.assertTrue(payload.get("hydrated_from_store"))


if __name__ == "__main__":
    unittest.main()
