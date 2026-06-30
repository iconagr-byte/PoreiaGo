"""Tests for fleet Prometheus metrics."""

from __future__ import annotations

import os
import unittest
from datetime import datetime, timezone
from unittest.mock import patch
from uuid import uuid4

from travel_platform.telemetry.coordinate_buffer import BufferedCoordinate, push_coordinate
from travel_platform.telemetry.driver_shift_tracker import (
    active_connection_count,
    on_driver_connected,
    on_driver_disconnected,
)
from travel_platform.telemetry.processor import get_live_fleet


class FleetMetricsTests(unittest.TestCase):
    def setUp(self) -> None:
        os.environ["METRICS_ENABLED"] = "true"
        import travel_platform.telemetry.fleet_metrics as fm

        fm._ENABLED = None

    def tearDown(self) -> None:
        os.environ.pop("METRICS_ENABLED", None)
        import travel_platform.telemetry.fleet_metrics as fm

        fm._ENABLED = None
        fm._last_tenant_gauges = set()

    def test_record_gps_ingress_increments(self) -> None:
        from travel_platform.telemetry.fleet_metrics import FLEET_GPS_INGRESS_TOTAL, record_gps_ingress

        tid = str(uuid4())
        before = FLEET_GPS_INGRESS_TOTAL.labels(tenant_id=tid)._value.get()
        record_gps_ingress(tid)
        after = FLEET_GPS_INGRESS_TOTAL.labels(tenant_id=tid)._value.get()
        self.assertEqual(after, before + 1.0)

    def test_record_fleet_alert_increments(self) -> None:
        from travel_platform.telemetry.fleet_metrics import FLEET_ALERTS_TOTAL, record_fleet_alert

        tid = str(uuid4())
        before = FLEET_ALERTS_TOTAL.labels(alert_type="ROUTE_DEVIATION", tenant_id=tid)._value.get()
        record_fleet_alert(alert_type="ROUTE_DEVIATION", tenant_id=tid)
        after = FLEET_ALERTS_TOTAL.labels(alert_type="ROUTE_DEVIATION", tenant_id=tid)._value.get()
        self.assertEqual(after, before + 1.0)

    def test_record_stale_offline_increments(self) -> None:
        from travel_platform.telemetry.fleet_metrics import FLEET_STALE_OFFLINE_TOTAL, record_stale_offline

        tid = str(uuid4())
        before = FLEET_STALE_OFFLINE_TOTAL.labels(tenant_id=tid)._value.get()
        record_stale_offline(tid)
        after = FLEET_STALE_OFFLINE_TOTAL.labels(tenant_id=tid)._value.get()
        self.assertEqual(after, before + 1.0)

    def test_refresh_fleet_gauges_from_live_state(self) -> None:
        from travel_platform.telemetry.fleet_metrics import (
            FLEET_ACTIVE_DRIVERS,
            FLEET_ACTIVE_VEHICLES,
            FLEET_COORDINATE_BUFFER_POINTS,
            FLEET_DRIVER_WS_CONNECTIONS,
            refresh_fleet_gauges,
        )

        tid = uuid4()
        live = get_live_fleet()
        vid = live.upsert_vehicle_registry(tid, "BUS-1", 42)
        live._vehicles[str(vid)] = {
            **live._vehicles.get(str(vid), {}),
            "tenant_id": str(tid),
            "lat": 37.98,
            "lng": 23.73,
            "driver_id": "driver-1",
            "updated_at": datetime.now(timezone.utc),
        }

        push_coordinate(
            BufferedCoordinate(
                tenant_id=str(tid),
                trip_id=42,
                driver_id="driver-1",
                vehicle_id=str(vid),
                lat=37.98,
                lng=23.73,
                speed_kmh=40.0,
                heading_deg=90.0,
                recorded_at=datetime.now(timezone.utc),
                raw={},
            ),
        )

        session = {"tenant_id": str(tid), "sub": "driver-1", "trip_id": 42}
        on_driver_connected(session, 1)

        refresh_fleet_gauges()

        self.assertEqual(FLEET_ACTIVE_VEHICLES.labels(tenant_id=str(tid))._value.get(), 1.0)
        self.assertEqual(FLEET_ACTIVE_DRIVERS.labels(tenant_id=str(tid))._value.get(), 1.0)
        self.assertGreaterEqual(FLEET_COORDINATE_BUFFER_POINTS._value.get(), 1.0)
        self.assertEqual(FLEET_DRIVER_WS_CONNECTIONS._value.get(), float(active_connection_count()))

        on_driver_disconnected(session, 1)

    def test_metrics_disabled_is_noop(self) -> None:
        os.environ["METRICS_ENABLED"] = "false"
        import travel_platform.telemetry.fleet_metrics as fm

        fm._ENABLED = None
        from travel_platform.telemetry.fleet_metrics import record_gps_ingress, record_stale_offline

        record_gps_ingress("tenant-x")
        record_stale_offline("tenant-x")
        refresh_fleet_gauges = fm.refresh_fleet_gauges
        refresh_fleet_gauges()


class FleetMetricsSyncTests(unittest.TestCase):
    def test_refresh_fleet_prometheus_gauges_calls_refresh(self) -> None:
        os.environ["METRICS_ENABLED"] = "true"
        with patch(
            "travel_platform.telemetry.fleet_metrics.refresh_fleet_gauges",
        ) as mock_refresh:
            from app.observability.metrics_sync import refresh_fleet_prometheus_gauges

            refresh_fleet_prometheus_gauges()
            mock_refresh.assert_called_once()
        os.environ.pop("METRICS_ENABLED", None)


if __name__ == "__main__":
    unittest.main()
