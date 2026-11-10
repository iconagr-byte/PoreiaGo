"""End-shift strips App only; Teltonika stays — dual badges when App soft-acks again."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
from uuid import UUID

from travel_platform.operations.master_qr_local import DEFAULT_TENANT
from travel_platform.telemetry.domain import TelemetryUpdate
from travel_platform.telemetry.live_fleet import LiveFleetService
from travel_platform.telemetry.teltonika import shift_suppress as ss

OFFICE = "81ce186d-40fd-4f51-8e62-1353a9e68f33"
SEED = "c8208a59-bb2b-4299-a4d5-6fbadbb9b089"
DRIVER = "df8f4625-f439-448d-a978-53f942bbc594"


def _ping(live: LiveFleetService, *, tenant_id: str, driver_id: str, code: str) -> str:
    update = TelemetryUpdate(
        vehicle_code=code,
        tenant_id=UUID(tenant_id),
        trip_id=1,
        latitude=40.8,
        longitude=22.05,
        speed_kmh=0,
        engine_on=False,
        fuel_level_pct=None,
        recorded_at=datetime.now(timezone.utc),
        raw={"driver_name": "Test", "bus_plate": code, "driver_id": driver_id},
    )
    vid = live.upsert_vehicle_registry(UUID(tenant_id), code, 1)
    live.apply_update(str(vid), update, idle_seconds=0)
    live._vehicles[str(vid)]["driver_id"] = driver_id
    return str(vid)


class RemoveDriverVehiclesTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        LiveFleetService._vehicles = {}
        LiveFleetService._code_index = {}
        ss._suppress_until.clear()

    async def test_clears_seed_mirror_and_office(self):
        live = LiveFleetService()
        office_vid = _ping(live, tenant_id=OFFICE, driver_id=DRIVER, code="TRIP-1")
        seed_vid = _ping(live, tenant_id=SEED, driver_id=DRIVER, code="TRIP-1b")
        other = _ping(live, tenant_id=SEED, driver_id="other-driver", code="OTHER")

        with patch(
            "travel_platform.telemetry.live_fleet_redis.delete_live_vehicle",
            new=AsyncMock(return_value=True),
        ) as delete_mock, patch(
            "travel_platform.telemetry.live_fleet_redis.load_live_vehicles",
            new=AsyncMock(return_value=[]),
        ), patch(
            "travel_platform.telemetry.teltonika.device_store.get_enabled_device_by_vehicle_code",
            return_value=None,
        ):
            removed = await live.remove_driver_vehicles(
                OFFICE,
                DRIVER,
                extra_tenant_ids=[SEED, DEFAULT_TENANT],
            )

        self.assertIn(office_vid, removed)
        self.assertIn(seed_vid, removed)
        self.assertNotIn(other, removed)
        self.assertNotIn(office_vid, live._vehicles)
        self.assertNotIn(seed_vid, live._vehicles)
        self.assertIn(other, live._vehicles)
        self.assertGreaterEqual(delete_mock.await_count, 2)

    async def test_clears_redis_only_pin(self):
        live = LiveFleetService()
        remote = {
            "vehicle_id": "remote-1",
            "tenant_id": SEED,
            "driver_id": DRIVER,
            "vehicle_code": "TRIP-1",
            "lat": 40.8,
            "lng": 22.05,
        }

        async def load(tid):
            return [remote] if tid == SEED else []

        with patch(
            "travel_platform.telemetry.live_fleet_redis.delete_live_vehicle",
            new=AsyncMock(return_value=True),
        ) as delete_mock, patch(
            "travel_platform.telemetry.live_fleet_redis.load_live_vehicles",
            new=AsyncMock(side_effect=load),
        ), patch(
            "travel_platform.telemetry.teltonika.device_store.get_enabled_device_by_vehicle_code",
            return_value=None,
        ):
            removed = await live.remove_driver_vehicles(
                OFFICE,
                DRIVER,
                extra_tenant_ids=[SEED],
            )

        self.assertEqual(removed, ["remote-1"])
        delete_mock.assert_any_await(SEED, "remote-1")

    async def test_shift_end_removes_unbound_app_pin_without_suppress(self):
        """Pure App pin (no IMEI) leaves the map; shift never suppresses Teltonika."""
        live = LiveFleetService()
        now = datetime.now(timezone.utc).isoformat()
        vid = str(live.upsert_vehicle_registry(UUID(OFFICE), "EEX5670", 1))
        live._vehicles[vid] = {
            "vehicle_id": vid,
            "tenant_id": OFFICE,
            "vehicle_code": "EEX5670",
            "bus_plate": "EEX5670",
            "lat": 38.25,
            "lng": 20.65,
            "source": "driver_pwa",
            "driver_id": DRIVER,
            "app_driver_id": DRIVER,
            "app_seen_at": now,
            "updated_at": now,
            "gps_sources": ["app"],
        }
        live._code_index[f"{OFFICE}:EEX5670"] = vid
        ss.suppress_plate_after_shift(OFFICE, "EEX5670", seconds=3600)

        with patch(
            "travel_platform.telemetry.live_fleet_redis.delete_live_vehicle",
            new=AsyncMock(return_value=True),
        ) as delete_mock, patch(
            "travel_platform.telemetry.live_fleet_redis.load_live_vehicles",
            new=AsyncMock(return_value=[]),
        ), patch(
            "travel_platform.telemetry.teltonika.device_store.get_enabled_device_by_vehicle_code",
            return_value=None,
        ):
            removed = await live.remove_driver_vehicles(OFFICE, DRIVER)

        self.assertEqual(removed, [vid])
        self.assertNotIn(vid, live._vehicles)
        delete_mock.assert_awaited()
        self.assertFalse(ss.is_shift_suppressed(OFFICE, "EEX5670"))

    async def test_shift_end_removes_stale_bound_without_suppress(self):
        """Offline bound IMEI pin is removed; hydrate can restore when online again."""
        live = LiveFleetService()
        old = datetime(2020, 1, 1, tzinfo=timezone.utc).isoformat()
        vid = str(live.upsert_vehicle_registry(UUID(OFFICE), "EEX5670", 1))
        live._vehicles[vid] = {
            "vehicle_id": vid,
            "tenant_id": OFFICE,
            "vehicle_code": "EEX5670",
            "bus_plate": "EEX5670",
            "lat": 38.25,
            "lng": 20.65,
            "source": "teltonika",
            "imei": "861076085468260",
            "driver_id": DRIVER,
            "app_driver_id": DRIVER,
            "app_seen_at": old,
            "tracker_signal_at": old,
            "updated_at": old,
            "gps_sources": ["teltonika", "app"],
        }
        live._code_index[f"{OFFICE}:EEX5670"] = vid
        tracker = {
            "tenant_id": OFFICE,
            "imei": "861076085468260",
            "vehicle_code": "EEX5670",
            "label": "Λεωφορείο με GPS",
            "enabled": True,
            "last_seen_at": old,
            "last_lat": 38.3,
            "last_lng": 20.7,
        }
        ss.suppress_plate_after_shift(OFFICE, "EEX5670", seconds=3600)

        with patch(
            "travel_platform.telemetry.live_fleet_redis.delete_live_vehicle",
            new=AsyncMock(return_value=True),
        ) as delete_mock, patch(
            "travel_platform.telemetry.live_fleet_redis.load_live_vehicles",
            new=AsyncMock(return_value=[]),
        ), patch(
            "travel_platform.telemetry.teltonika.device_store.get_enabled_device_by_vehicle_code",
            return_value=tracker,
        ):
            removed = await live.remove_driver_vehicles(OFFICE, DRIVER)

        self.assertEqual(removed, [vid])
        self.assertNotIn(vid, live._vehicles)
        delete_mock.assert_awaited()
        self.assertFalse(ss.is_shift_suppressed(OFFICE, "EEX5670"))

    async def test_shift_end_keeps_alive_teltonika_strips_app(self):
        """Online hardware stays; App channel cleared so dual badge can reopen on soft-ack."""
        live = LiveFleetService()
        vid = _ping(live, tenant_id=OFFICE, driver_id=DRIVER, code="EEX5670")
        live._vehicles[vid]["source"] = "driver_pwa"
        live._vehicles[vid]["app_driver_id"] = DRIVER
        live._vehicles[vid]["app_seen_at"] = datetime.now(timezone.utc).isoformat()
        tracker = {
            "tenant_id": OFFICE,
            "imei": "861076085468260",
            "vehicle_code": "EEX5670",
            "label": "Λεωφορείο με GPS",
            "enabled": True,
            "last_seen_at": datetime.now(timezone.utc).isoformat(),
            "last_lat": 38.3,
            "last_lng": 20.7,
            "last_speed_kmh": 12,
        }

        with patch(
            "travel_platform.telemetry.live_fleet_redis.delete_live_vehicle",
            new=AsyncMock(return_value=True),
        ) as delete_mock, patch(
            "travel_platform.telemetry.live_fleet_redis.load_live_vehicles",
            new=AsyncMock(return_value=[]),
        ), patch(
            "travel_platform.telemetry.live_fleet_redis.save_live_vehicle",
            new=AsyncMock(return_value=True),
        ) as save_mock, patch(
            "travel_platform.telemetry.teltonika.device_store.get_enabled_device_by_vehicle_code",
            return_value=tracker,
        ), patch(
            "travel_platform.telemetry.teltonika.paint_live.paint_live_pin_from_device",
            new=AsyncMock(return_value=True),
        ) as paint_mock:
            removed = await live.remove_driver_vehicles(OFFICE, DRIVER)

        self.assertEqual(removed, [])
        self.assertIn(vid, live._vehicles)
        kept = live._vehicles[vid]
        self.assertIsNone(kept.get("driver_id"))
        self.assertIsNone(kept.get("app_driver_id"))
        self.assertEqual(kept.get("source"), "teltonika")
        self.assertEqual(kept.get("gps_sources"), ["teltonika"])
        self.assertEqual(kept.get("imei"), "861076085468260")
        delete_mock.assert_not_awaited()
        save_mock.assert_awaited()
        paint_mock.assert_awaited()
        self.assertFalse(ss.is_shift_suppressed(OFFICE, "EEX5670"))


if __name__ == "__main__":
    unittest.main()
