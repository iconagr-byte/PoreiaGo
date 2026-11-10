"""Contract: fleet map must not use the 2MB hero PNG as marker avatar."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class FleetMarkerDefaultImageTests(unittest.TestCase):
    def test_default_is_thumb_not_hero(self) -> None:
        js = (ROOT / "src" / "lib" / "admin" / "fleetVehicleDetails.js").read_text(
            encoding="utf-8"
        )
        self.assertIn("fleet-bus-thumb.jpg", js)
        self.assertNotIn("DEFAULT_FLEET_BUS_IMAGE = '/images/hero-bus-achillio.png'", js)
        thumb = ROOT / "public" / "images" / "fleet-bus-thumb.jpg"
        self.assertTrue(thumb.is_file())
        self.assertLess(thumb.stat().st_size, 40_000)

    def test_leaflet_icon_cache_present(self) -> None:
        leaflet = (
            ROOT / "src" / "components" / "admin" / "FleetLiveMapLeaflet.jsx"
        ).read_text(encoding="utf-8")
        self.assertIn("BUS_ICON_CACHE", leaflet)


if __name__ == "__main__":
    unittest.main()
