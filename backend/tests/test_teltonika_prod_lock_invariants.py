"""Production lock invariants for Achillio Teltonika live map (#935–#937)."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
from uuid import UUID

from travel_platform.telemetry.domain import TelemetryUpdate
from travel_platform.telemetry.live_fleet import LiveFleetService
from travel_platform.telemetry.teltonika import shift_suppress as ss
from travel_platform.telemetry.teltonika import tcp_server as tcp

OFFICE = "97798681-2f60-4398-b1f6-9eb38dc341b0"
DRIVER = "df8f4625-f439-448d-a978-53f942bbc594"


class TeltonikaProdLockInvariantTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        LiveFleetService._vehicles = {}
        LiveFleetService._code_index = {}
        ss._suppress_until.clear()
        tcp._open_imeis.clear()
        tcp._open_imei_refs.clear()

    async def test_end_shift_never_suppresses_alive_hardware(self):
        live = LiveFleetService()
        update = TelemetryUpdate(
            vehicle_code="EEX5670",
            tenant_id=UUID(OFFICE),
            trip_id=1,
            latitude=39.71,
            longitude=21.01,
            speed_kmh=12,
            engine_on=True,
            fuel_level_pct=None,
            recorded_at=datetime.now(timezone.utc),
            raw={"driver_name": "Ax", "bus_plate": "EEX5670", "driver_id": DRIVER},
        )
        vid = str(live.upsert_vehicle_registry(UUID(OFFICE), "EEX5670", 1))
        live.apply_update(vid, update, idle_seconds=0)
        live._vehicles[vid]["driver_id"] = DRIVER
        live._vehicles[vid]["app_driver_id"] = DRIVER
        live._vehicles[vid]["source"] = "driver_pwa"
        tracker = {
            "tenant_id": OFFICE,
            "imei": "861076085468260",
            "vehicle_code": "EEX5670",
            "label": "Λεωφορείο με GPS",
            "enabled": True,
            "last_seen_at": datetime.now(timezone.utc).isoformat(),
            "last_lat": 39.71,
            "last_lng": 21.01,
        }
        ss.suppress_plate_after_shift(OFFICE, "EEX5670", seconds=3600)

        with patch(
            "travel_platform.telemetry.live_fleet_redis.delete_live_vehicle",
            new=AsyncMock(return_value=True),
        ), patch(
            "travel_platform.telemetry.live_fleet_redis.load_live_vehicles",
            new=AsyncMock(return_value=[]),
        ), patch(
            "travel_platform.telemetry.live_fleet_redis.save_live_vehicle",
            new=AsyncMock(return_value=True),
        ), patch(
            "travel_platform.telemetry.teltonika.device_store.get_enabled_device_by_vehicle_code",
            return_value=tracker,
        ), patch(
            "travel_platform.telemetry.teltonika.paint_live.paint_live_pin_from_device",
            new=AsyncMock(return_value=True),
        ):
            removed = await live.remove_driver_vehicles(OFFICE, DRIVER)

        self.assertEqual(removed, [])
        self.assertIn(vid, live._vehicles)
        kept = live._vehicles[vid]
        self.assertEqual(kept.get("source"), "teltonika")
        self.assertIsNone(kept.get("app_seen_at"))
        self.assertFalse(ss.is_shift_suppressed(OFFICE, "EEX5670"))
        # Fresh stamp — list_active must not drop the pin as stale.
        age = (
            datetime.now(timezone.utc)
            - datetime.fromisoformat(str(kept["updated_at"]).replace("Z", "+00:00"))
        ).total_seconds()
        self.assertLess(age, 5)

    def test_tcp_open_imei_checks_local_set(self):
        imei = "861076085468260"
        tcp._retain_open_imei(imei)
        try:
            self.assertTrue(tcp.is_imei_tcp_connected(imei))
        finally:
            tcp._release_open_imei(imei)
        self.assertFalse(tcp.is_imei_tcp_connected(imei))


if __name__ == "__main__":
    unittest.main()
