"""Geofence map layers service tests."""

from __future__ import annotations

import unittest
from uuid import UUID

from travel_platform.telemetry.fleet_geofence_map_service import fetch_geofence_map_layers

TENANT = UUID("00000000-0000-0000-0000-000000000001")


class GeofenceMapLayersTests(unittest.TestCase):
    def test_trip_1_has_corridor_and_stops(self):
        payload = fetch_geofence_map_layers(TENANT, trip_ids=[1])
        self.assertEqual(payload["trip_ids"], [1])
        self.assertGreaterEqual(len(payload["corridors"]), 1)
        self.assertGreaterEqual(len(payload["stops"]), 1)
        self.assertGreaterEqual(payload["corridors"][0]["buffer_m"], 30)

    def test_unknown_trip_returns_empty_corridor(self):
        payload = fetch_geofence_map_layers(TENANT, trip_ids=[9999])
        self.assertEqual(payload["corridors"], [])


if __name__ == "__main__":
    unittest.main()
