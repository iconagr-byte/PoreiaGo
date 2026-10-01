"""One live pin per plate — Teltonika wins over leftover App GPS."""

from __future__ import annotations

import asyncio
import unittest
from datetime import datetime, timedelta, timezone
from uuid import UUID

from travel_platform.telemetry.live_fleet import LiveFleetService
from travel_platform.telemetry.tracker_priority import (
    dedupe_live_metas_by_plate,
    prefer_meta_for_plate,
)


class TeltonikaPinDedupeTests(unittest.TestCase):
    def setUp(self):
        LiveFleetService._vehicles = {}
        LiveFleetService._code_index = {}
        self.tenant = "97798681-2f60-4398-b1f6-9eb38dc341b0"
        self.now = datetime.now(timezone.utc)

    def test_prefer_fresh_teltonika_over_phone(self):
        phone = {
            "vehicle_id": "phone-1",
            "vehicle_code": "EEX5670",
            "source": "driver_pwa",
            "lat": 38.1,
            "lng": 20.5,
            "updated_at": self.now.isoformat(),
        }
        teltonika = {
            "vehicle_id": "tel-1",
            "vehicle_code": "EEX5670",
            "source": "teltonika",
            "imei": "861076085468260",
            "lat": 38.2,
            "lng": 20.6,
            "updated_at": self.now.isoformat(),
        }
        chosen = prefer_meta_for_plate(phone, teltonika, max_age_sec=90, now=self.now)
        self.assertEqual(chosen["vehicle_id"], "tel-1")

    def test_dedupe_metas_keeps_one_pin(self):
        metas = [
            {
                "vehicle_id": "phone-1",
                "vehicle_code": "EEX5670",
                "bus_plate": "EEX5670",
                "source": "driver_pwa",
                "lat": 38.1,
                "lng": 20.5,
                "updated_at": self.now.isoformat(),
            },
            {
                "vehicle_id": "tel-1",
                "vehicle_code": "eex5670",
                "bus_plate": "EEX5670",
                "source": "teltonika",
                "imei": "861076085468260",
                "lat": 38.2,
                "lng": 20.6,
                "updated_at": self.now.isoformat(),
            },
        ]
        out = dedupe_live_metas_by_plate(metas, max_age_sec=90, now=self.now)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["source"], "teltonika")

    def test_list_active_dedupes_same_plate(self):
        fleet = LiveFleetService()
        LiveFleetService._vehicles = {
            "phone-1": {
                "vehicle_id": "phone-1",
                "tenant_id": self.tenant,
                "vehicle_code": "EEX5670",
                "bus_plate": "EEX5670",
                "source": "driver_pwa",
                "lat": 38.1,
                "lng": 20.5,
                "speed_kmh": 0,
                "updated_at": self.now.isoformat(),
            },
            "tel-1": {
                "vehicle_id": "tel-1",
                "tenant_id": self.tenant,
                "vehicle_code": "EEX5670",
                "bus_plate": "EEX5670",
                "source": "teltonika",
                "imei": "861076085468260",
                "lat": 38.2,
                "lng": 20.6,
                "speed_kmh": 0,
                "updated_at": self.now.isoformat(),
            },
        }
        LiveFleetService._code_index = {f"{self.tenant}:EEX5670": "phone-1"}
        active = fleet.list_active(UUID(self.tenant))
        self.assertEqual(len(active), 1)
        self.assertEqual(active[0].vehicle_id, "tel-1")

    def test_purge_removes_phone_sibling(self):
        fleet = LiveFleetService()
        LiveFleetService._vehicles = {
            "phone-1": {
                "vehicle_id": "phone-1",
                "tenant_id": self.tenant,
                "vehicle_code": "EEX5670",
                "bus_plate": "EEX5670",
                "source": "driver_pwa",
                "lat": 38.1,
                "lng": 20.5,
                "updated_at": self.now.isoformat(),
            },
            "tel-1": {
                "vehicle_id": "tel-1",
                "tenant_id": self.tenant,
                "vehicle_code": "EEX5670",
                "bus_plate": "EEX5670",
                "source": "teltonika",
                "imei": "861076085468260",
                "lat": 38.2,
                "lng": 20.6,
                "updated_at": self.now.isoformat(),
            },
        }
        LiveFleetService._code_index = {f"{self.tenant}:EEX5670": "phone-1"}

        async def _run():
            with unittest.mock.patch(
                "travel_platform.telemetry.live_fleet_redis.delete_live_vehicle",
                new_callable=unittest.mock.AsyncMock,
                return_value=True,
            ), unittest.mock.patch(
                "travel_platform.telemetry.live_fleet_redis.load_live_vehicles",
                new_callable=unittest.mock.AsyncMock,
                return_value=[],
            ):
                return await fleet.purge_phone_siblings_for_plate(
                    self.tenant,
                    "EEX5670",
                    keep_vehicle_id="tel-1",
                )

        import unittest.mock

        removed = asyncio.run(_run())
        self.assertIn("phone-1", removed)
        self.assertNotIn("phone-1", LiveFleetService._vehicles)
        self.assertIn("tel-1", LiveFleetService._vehicles)
        self.assertEqual(LiveFleetService._code_index.get(f"{self.tenant}:EEX5670"), "tel-1")

    def test_stale_teltonika_loses_to_newer_phone(self):
        phone = {
            "vehicle_id": "phone-1",
            "vehicle_code": "EEX5670",
            "source": "driver_pwa",
            "lat": 38.1,
            "lng": 20.5,
            "updated_at": self.now.isoformat(),
        }
        teltonika = {
            "vehicle_id": "tel-1",
            "vehicle_code": "EEX5670",
            "source": "teltonika",
            "lat": 38.2,
            "lng": 20.6,
            "updated_at": (self.now - timedelta(seconds=400)).isoformat(),
        }
        # No Teltonika signal → App soft fallback wins the map pin.
        chosen = prefer_meta_for_plate(phone, teltonika, max_age_sec=90, now=self.now)
        self.assertEqual(chosen["vehicle_id"], "phone-1")


if __name__ == "__main__":
    unittest.main()
