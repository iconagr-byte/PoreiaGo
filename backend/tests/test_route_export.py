"""GPX / KML export builders."""

from __future__ import annotations

import unittest

from travel_platform.telemetry.route_export import build_gpx, build_kml, export_route_document


class RouteExportTests(unittest.TestCase):
    def _sample_points(self):
        return [
            {"lat": 38.0, "lng": 23.0, "speed_kmh": 60, "recorded_at": "2026-01-01T10:00:00+00:00"},
            {"lat": 38.01, "lng": 23.01, "speed_kmh": 62, "recorded_at": "2026-01-01T10:05:00+00:00"},
        ]

    def test_build_gpx_contains_trackpoints(self):
        xml = build_gpx(1, self._sample_points())
        self.assertIn("<trkpt", xml)
        self.assertIn('lat="38.0000000"', xml)
        self.assertIn('lon="23.0000000"', xml)

    def test_build_kml_linestring(self):
        xml = build_kml(2, self._sample_points())
        self.assertIn("<LineString>", xml)
        self.assertIn("23.0000000,38.0000000,0", xml)

    def test_export_route_document_gpx(self):
        content, media, filename = export_route_document(3, self._sample_points(), fmt="gpx")
        self.assertEqual(media, "application/gpx+xml")
        self.assertTrue(filename.endswith(".gpx"))
        self.assertIn("trk", content)


if __name__ == "__main__":
    unittest.main()
