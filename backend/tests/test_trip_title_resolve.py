"""Trip title resolution for live map labels."""

from __future__ import annotations

import unittest

from travel_platform.telemetry.trip_title_resolve import (
    format_trip_fallback,
    resolve_trip_title_sync,
)


class TripTitleResolveTests(unittest.TestCase):
    def test_fallback(self):
        self.assertEqual(format_trip_fallback(12), "Εκδρομή #12")
        self.assertEqual(format_trip_fallback(None), "")

    def test_preferred_cached(self):
        self.assertEqual(resolve_trip_title_sync(42, preferred="Μετέωρα Day Trip"), "Μετέωρα Day Trip")
        self.assertEqual(resolve_trip_title_sync(42), "Μετέωρα Day Trip")


if __name__ == "__main__":
    unittest.main()
