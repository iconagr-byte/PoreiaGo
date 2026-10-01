"""Teltonika-first map priority with soft phone GPS fallback when tracker is stale."""

from __future__ import annotations

import asyncio
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

import travel_platform.telemetry.driver_gps_heartbeat  # noqa: F401 — patch target
import travel_platform.telemetry.fleet_location_webhook  # noqa: F401 — patch target
import travel_platform.telemetry.fleet_metrics  # noqa: F401 — patch target
from travel_platform.telemetry.fleet_ingress import ingest_driver_location
from travel_platform.telemetry.teltonika import device_store as ds
from travel_platform.telemetry.tracker_priority import (
    is_teltonika_preferred_for_plate,
    is_teltonika_preferred_for_plate_async,
    is_tracker_binding_alive,
    normalize_vehicle_plate,
)


class TeltonikaPriorityFallbackTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        path = Path(self.tmp.name) / "devices.json"
        self.patcher = patch.object(ds, "_store_path", return_value=path)
        self.patcher.start()
        self.tenant = "97798681-2f60-4398-b1f6-9eb38dc341b0"
        self.device = ds.upsert_device(
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

    def test_binding_alive_when_last_seen_recent(self):
        recent = (datetime.now(timezone.utc) - timedelta(seconds=20)).isoformat()
        self.assertTrue(is_tracker_binding_alive({"last_seen_at": recent}, max_age_sec=90))

    def test_binding_dead_when_last_seen_old(self):
        old = (datetime.now(timezone.utc) - timedelta(seconds=300)).isoformat()
        self.assertFalse(is_tracker_binding_alive({"last_seen_at": old}, max_age_sec=90))

    def _seed_live_teltonika_pin(self):
        """Put a fresh Teltonika pin on the in-memory live fleet for this plate."""
        from travel_platform.telemetry.live_fleet import LiveFleetService

        LiveFleetService._vehicles = {}
        LiveFleetService._code_index = {}
        vid = "veh-teltonika-1"
        LiveFleetService._code_index[f"{self.tenant}:EEX5670"] = vid
        LiveFleetService._vehicles[vid] = {
            "vehicle_id": vid,
            "tenant_id": self.tenant,
            "vehicle_code": "EEX5670",
            "bus_plate": "EEX5670",
            "lat": 38.2,
            "lng": 20.6,
            "source": "teltonika",
            "imei": "861076085468260",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        return vid

    def test_prefer_teltonika_when_live_pin_fresh(self):
        self._seed_live_teltonika_pin()
        prefer, tracker = is_teltonika_preferred_for_plate(self.tenant, "EEX5670", max_age_sec=90)
        self.assertTrue(prefer)
        self.assertEqual(tracker.get("imei"), "861076085468260")

    def test_hydrated_closed_tracker_not_preferred(self):
        """Parked hydrate must not soft-ack as an open Teltonika channel."""
        from travel_platform.telemetry.live_fleet import LiveFleetService
        from travel_platform.telemetry.tracker_priority import (
            is_live_meta_tracker_fresh,
            resolve_live_gps_sources,
        )

        LiveFleetService._vehicles = {}
        LiveFleetService._code_index = {}
        vid = "veh-hydrated"
        old = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
        LiveFleetService._code_index[f"{self.tenant}:EEX5670"] = vid
        LiveFleetService._vehicles[vid] = {
            "vehicle_id": vid,
            "tenant_id": self.tenant,
            "vehicle_code": "EEX5670",
            "bus_plate": "EEX5670",
            "lat": 38.2,
            "lng": 20.6,
            "source": "teltonika",
            "imei": "861076085468260",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "tracker_signal_at": old,
            "hydrated_from_store": True,
            "app_seen_at": datetime.now(timezone.utc).isoformat(),
        }
        prefer, _ = is_teltonika_preferred_for_plate(self.tenant, "EEX5670", max_age_sec=90)
        self.assertFalse(prefer)
        meta = LiveFleetService._vehicles[vid]
        self.assertFalse(is_live_meta_tracker_fresh(meta, max_age_sec=90))
        self.assertEqual(resolve_live_gps_sources(meta, max_age_sec=90), ["app"])

    def test_normalize_folds_greek_lookalike_plate(self):
        from travel_platform.telemetry.tracker_priority import plate_display

        self.assertEqual(normalize_vehicle_plate("ΕΕΧ-5670"), "EEX5670")
        self.assertEqual(normalize_vehicle_plate("eex 5670"), "EEX5670")
        # Display keeps hyphens; match key strips them.
        self.assertEqual(plate_display("trip-1"), "TRIP-1")
        self.assertEqual(normalize_vehicle_plate("TRIP-1"), "TRIP1")

    def test_prefer_teltonika_from_redis_when_memory_empty(self):
        """Multi-worker: phone ingest must soft-ack via Redis Teltonika pin."""
        from travel_platform.telemetry.live_fleet import LiveFleetService

        LiveFleetService._vehicles = {}
        LiveFleetService._code_index = {}
        remote = {
            "vehicle_id": "veh-redis-tel",
            "tenant_id": self.tenant,
            "vehicle_code": "EEX5670",
            "bus_plate": "EEX5670",
            "lat": 38.2,
            "lng": 20.6,
            "source": "teltonika",
            "imei": "861076085468260",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        async def _run():
            with patch(
                "travel_platform.telemetry.live_fleet_redis.load_live_vehicles",
                new_callable=AsyncMock,
                return_value=[remote],
            ):
                return await is_teltonika_preferred_for_plate_async(
                    self.tenant, "EEX5670", max_age_sec=90
                )

        prefer, tracker = asyncio.run(_run())
        self.assertTrue(prefer)
        self.assertEqual(tracker.get("imei"), "861076085468260")
        self.assertIn("veh-redis-tel", LiveFleetService._vehicles)

    def test_no_prefer_when_only_device_last_seen(self):
        """last_seen alone must not soft-ack — that blanks the map when queue lags."""
        ds.touch_device("861076085468260", lat=38.2, lng=20.6, speed_kmh=40, points=1)
        from travel_platform.telemetry.live_fleet import LiveFleetService

        LiveFleetService._vehicles = {}
        LiveFleetService._code_index = {}
        prefer, tracker = is_teltonika_preferred_for_plate(self.tenant, "EEX5670", max_age_sec=90)
        self.assertFalse(prefer)
        self.assertIsNotNone(tracker)

    def test_fallback_when_tracker_stale(self):
        # Live pin exists but is stale → phone may paint.
        from travel_platform.telemetry.live_fleet import LiveFleetService

        LiveFleetService._vehicles = {}
        LiveFleetService._code_index = {}
        vid = "veh-old"
        LiveFleetService._code_index[f"{self.tenant}:EEX5670"] = vid
        LiveFleetService._vehicles[vid] = {
            "vehicle_id": vid,
            "tenant_id": self.tenant,
            "vehicle_code": "EEX5670",
            "lat": 38.2,
            "lng": 20.6,
            "source": "teltonika",
            "updated_at": (datetime.now(timezone.utc) - timedelta(seconds=400)).isoformat(),
        }
        prefer, tracker = is_teltonika_preferred_for_plate(self.tenant, "EEX5670", max_age_sec=90)
        self.assertFalse(prefer)
        self.assertIsNotNone(tracker)

    def test_ingest_soft_acks_when_live_teltonika_pin(self):
        self._seed_live_teltonika_pin()
        session = {
            "tenant_id": self.tenant,
            "driver_id": "drv-1",
            "driver_name": "Nikos",
            "vehicle_code": "EEX5670",
        }
        body = {"lat": 38.25, "lng": 20.65, "speed": 40, "bus_plate": "EEX5670"}

        with (
            patch(
                "travel_platform.telemetry.fleet_ingress.process_telemetry_payload",
                new_callable=AsyncMock,
            ) as process,
            patch("travel_platform.settings.drivers_store.get_driver", return_value=None),
            patch("travel_platform.settings.drivers_store.is_seed_driver", return_value=False),
            patch(
                "travel_platform.operations.master_qr_bridge.resolve_platform_tenant_id",
                new_callable=AsyncMock,
                return_value=self.tenant,
            ),
            patch(
                "travel_platform.telemetry.driver_gps_heartbeat.touch_driver_gps",
                return_value=False,
            ) as touch,
            patch(
                "travel_platform.telemetry.live_fleet_redis.save_live_vehicle",
                new_callable=AsyncMock,
                return_value=True,
            ),
            patch(
                "travel_platform.telemetry.live_fleet_redis.delete_live_vehicle",
                new_callable=AsyncMock,
                return_value=True,
            ),
            patch(
                "travel_platform.telemetry.live_fleet_redis.load_live_vehicles",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch(
                "travel_platform.telemetry.fleet_pubsub.publish_fleet_location",
                new_callable=AsyncMock,
            ),
            patch(
                "travel_platform.telemetry.fleet_ws_hub.get_fleet_egress_hub",
                return_value=type("H", (), {"broadcast": AsyncMock()})(),
            ),
        ):
            out = asyncio.run(ingest_driver_location(body, session=session))

        self.assertTrue(out.get("ok"))
        self.assertTrue(out.get("skipped_live_map"))
        self.assertEqual(out.get("map_source"), "teltonika")
        self.assertIn("teltonika", out.get("gps_sources") or [])
        self.assertIn("app", out.get("gps_sources") or [])
        process.assert_not_awaited()
        touch.assert_called()
        from travel_platform.telemetry.live_fleet import LiveFleetService

        meta = LiveFleetService._vehicles.get("veh-teltonika-1") or {}
        self.assertTrue(meta.get("app_seen_at"))
        self.assertIn("app", meta.get("gps_sources") or [])

    def test_ingest_allows_phone_when_tracker_stale(self):
        with ds._LOCK:  # noqa: SLF001
            data = ds._read()  # noqa: SLF001
            for row in data.get("devices") or []:
                if row.get("imei") == "861076085468260":
                    row["last_seen_at"] = (
                        datetime.now(timezone.utc) - timedelta(seconds=400)
                    ).isoformat()
            ds._write(data)  # noqa: SLF001

        session = {
            "tenant_id": self.tenant,
            "driver_id": "drv-1",
            "driver_name": "Nikos",
            "vehicle_code": "EEX5670",
        }
        body = {"lat": 38.25, "lng": 20.65, "speed": 40, "bus_plate": "EEX5670"}

        with (
            patch(
                "travel_platform.telemetry.fleet_ingress.process_telemetry_payload",
                new_callable=AsyncMock,
            ) as process,
            patch("travel_platform.settings.drivers_store.get_driver", return_value=None),
            patch("travel_platform.settings.drivers_store.is_seed_driver", return_value=False),
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
                create=True,
                return_value=None,
            ),
            patch(
                "travel_platform.telemetry.driver_gps_heartbeat.touch_driver_gps",
                create=True,
                return_value=False,
            ),
            patch(
                "travel_platform.telemetry.fleet_location_webhook.maybe_dispatch_fleet_location_webhook",
                create=True,
                return_value=None,
            ),
        ):
            out = asyncio.run(ingest_driver_location(body, session=session))

        self.assertTrue(out.get("ok"))
        self.assertNotEqual(out.get("skipped_live_map"), True)
        process.assert_awaited()
        payload = process.await_args.args[0]
        self.assertEqual(payload.get("map_fallback"), "phone_after_tracker_stale")

    def test_ingest_allows_phone_for_unbound_plate(self):
        session = {
            "tenant_id": self.tenant,
            "driver_id": "drv-2",
            "driver_name": "Maria",
            "vehicle_code": "FREE123",
        }
        body = {"lat": 38.1, "lng": 23.7, "speed": 10, "bus_plate": "FREE123"}

        with (
            patch(
                "travel_platform.telemetry.fleet_ingress.process_telemetry_payload",
                new_callable=AsyncMock,
            ) as process,
            patch("travel_platform.settings.drivers_store.get_driver", return_value=None),
            patch("travel_platform.settings.drivers_store.is_seed_driver", return_value=False),
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
                create=True,
                return_value=None,
            ),
            patch(
                "travel_platform.telemetry.driver_gps_heartbeat.touch_driver_gps",
                create=True,
                return_value=False,
            ),
            patch(
                "travel_platform.telemetry.fleet_location_webhook.maybe_dispatch_fleet_location_webhook",
                create=True,
                return_value=None,
            ),
        ):
            out = asyncio.run(ingest_driver_location(body, session=session))

        self.assertNotEqual(out.get("rejected"), True)
        process.assert_awaited()


if __name__ == "__main__":
    unittest.main()
