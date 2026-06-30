"""Planned vs actual route — compliance metrics."""

from __future__ import annotations

import unittest
from uuid import UUID

from travel_platform.telemetry.planned_vs_actual import (
    compliance_metrics,
    get_planned_corridor_points,
    stops_to_planned_points,
)


TENANT = UUID("00000000-0000-0000-0000-000000000001")


class PlannedVsActualTests(unittest.TestCase):
    def test_stops_to_planned_points(self):
        stops = [
            {"lat": 38.0, "lng": 23.0, "name": "A"},
            {"lat": 38.01, "lng": 23.01},
            {"bad": True},
        ]
        pts = stops_to_planned_points(stops)
        self.assertEqual(len(pts), 2)
        self.assertEqual(pts[0], (38.0, 23.0))

    def test_corridor_for_trip_1(self):
        pts, source, buffer_m = get_planned_corridor_points(TENANT, 1)
        self.assertEqual(source, "corridor_geofence")
        self.assertGreaterEqual(len(pts), 2)
        self.assertGreaterEqual(buffer_m, 30)

    def test_planned_from_stops_overrides_corridor(self):
        stops = [{"lat": 39.0, "lng": 22.0}, {"lat": 39.1, "lng": 22.1}]
        pts, source, _ = get_planned_corridor_points(TENANT, 1, planned_stops=stops)
        self.assertEqual(source, "trip_stops")
        self.assertEqual(len(pts), 2)

    def test_compliance_on_corridor(self):
        planned = [(38.0, 23.0), (38.1, 23.1)]
        actual = [{"lat": 38.05, "lng": 23.05}]
        m = compliance_metrics(actual, planned, buffer_m=500)
        self.assertEqual(m["on_corridor_pct"], 100.0)

    def test_compliance_off_corridor(self):
        planned = [(38.0, 23.0), (38.1, 23.0)]
        actual = [{"lat": 38.05, "lng": 23.5}]
        m = compliance_metrics(actual, planned, buffer_m=50)
        self.assertLess(m["on_corridor_pct"], 100.0)
        self.assertGreater(m["mean_deviation_m"], 1000)


if __name__ == "__main__":
    unittest.main()
