"""Heatmap grid aggregation tests."""

from __future__ import annotations

import unittest

from travel_platform.telemetry.trip_heatmap_service import aggregate_points_to_grid


class TripHeatmapTests(unittest.TestCase):
    def test_aggregate_groups_nearby_points(self):
        points = [
            {"lat": 38.0, "lng": 23.0},
            {"lat": 38.001, "lng": 23.001},
            {"lat": 38.002, "lng": 23.002},
            {"lat": 39.0, "lng": 22.0},
        ]
        grid = aggregate_points_to_grid(points, cell_size=0.01, min_weight=2)
        self.assertEqual(len(grid), 1)
        self.assertEqual(grid[0]["weight"], 3)

    def test_min_weight_filters_sparse_cells(self):
        points = [
            {"lat": 38.0, "lng": 23.0},
            {"lat": 39.0, "lng": 22.0},
        ]
        grid = aggregate_points_to_grid(points, cell_size=0.01, min_weight=2)
        self.assertEqual(grid, [])

    def test_max_cells_cap(self):
        points = [{"lat": 38.0 + i * 0.05, "lng": 23.0} for i in range(20)]
        grid = aggregate_points_to_grid(points, cell_size=0.01, min_weight=1, max_cells=5)
        self.assertLessEqual(len(grid), 5)


if __name__ == "__main__":
    unittest.main()
