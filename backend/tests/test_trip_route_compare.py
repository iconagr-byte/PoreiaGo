"""Σύγκριση διαδρομών — haversine metrics."""

from __future__ import annotations

import unittest

from travel_platform.telemetry.trip_route_compare import (
    compare_routes,
    cross_track_deviation_m,
    haversine_m,
    path_length_km,
    summarize_route,
)


class RouteMetricsTests(unittest.TestCase):
    def test_haversine_zero_for_same_point(self):
        self.assertAlmostEqual(haversine_m(38.0, 23.0, 38.0, 23.0), 0.0)

    def test_path_length_two_points(self):
        points = [
            {"lat": 38.0, "lng": 23.0, "speed_kmh": 50, "recorded_at": "2026-01-01T10:00:00+00:00"},
            {"lat": 38.01, "lng": 23.01, "speed_kmh": 50, "recorded_at": "2026-01-01T10:05:00+00:00"},
        ]
        km = path_length_km(points)
        self.assertGreater(km, 1.0)
        self.assertLess(km, 2.0)

    def test_compare_routes_metrics(self):
        route_a = {
            "trip_id": 1,
            "tenant_id": "t1",
            "points": [
                {"lat": 38.0, "lng": 23.0, "speed_kmh": 60, "recorded_at": "2026-01-01T10:00:00+00:00"},
                {"lat": 38.02, "lng": 23.02, "speed_kmh": 62, "recorded_at": "2026-01-01T10:10:00+00:00"},
            ],
        }
        route_b = {
            "trip_id": 2,
            "tenant_id": "t1",
            "points": [
                {"lat": 38.001, "lng": 23.001, "speed_kmh": 55, "recorded_at": "2026-01-02T10:00:00+00:00"},
                {"lat": 38.021, "lng": 23.021, "speed_kmh": 58, "recorded_at": "2026-01-02T10:12:00+00:00"},
            ],
        }
        result = compare_routes(route_a, route_b)
        self.assertEqual(result["trip_a"], 1)
        self.assertEqual(result["trip_b"], 2)
        self.assertIn("symmetric_mean_deviation_m", result["metrics"])
        self.assertLess(result["metrics"]["symmetric_mean_deviation_m"], 500)

    def test_cross_track_deviation_parallel_routes(self):
        a = [{"lat": 38.0 + i * 0.001, "lng": 23.0} for i in range(5)]
        b = [{"lat": 38.0 + i * 0.001, "lng": 23.001} for i in range(5)]
        dev = cross_track_deviation_m(a, b, sample_every=1)
        self.assertGreater(dev["mean_m"], 50)
        self.assertLess(dev["mean_m"], 200)


if __name__ == "__main__":
    unittest.main()
