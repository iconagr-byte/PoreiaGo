"""Contract: a single storefront trip card stays narrow (new offices)."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class SoloTripCardWidthTests(unittest.TestCase):
    def test_solo_grid_uses_narrow_max_width(self) -> None:
        js = (ROOT / "src" / "lib" / "homepage" / "homepageTemplates.js").read_text(
            encoding="utf-8"
        )
        self.assertIn("tripCount === 1", js)
        self.assertIn("max-w-[300px]", js)
        self.assertIn("max-w-[380px]", js)
        # Must not stretch a lone card to the old wide xl width.
        self.assertNotIn(
            "max-w-md sm:max-w-lg md:max-w-xl mx-auto gap-8 w-full",
            js,
        )

    def test_premium_card_has_solo_compact_styles(self) -> None:
        card = (ROOT / "src" / "components" / "storefront" / "TripCard.jsx").read_text(
            encoding="utf-8"
        )
        self.assertIn("solo ? 'h-32 sm:h-36'", card)
        self.assertIn("solo ? 'p-4 sm:p-5'", card)
        self.assertIn("compact={solo}", card)


if __name__ == "__main__":
    unittest.main()
