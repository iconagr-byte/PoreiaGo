"""Contract: Trip form no longer shows auto cost & yield panel."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class RemoveCostYieldPanelTests(unittest.TestCase):
    def test_trip_form_has_no_cost_yield_section(self) -> None:
        form = (ROOT / "src" / "components" / "admin" / "TripForm.jsx").read_text(
            encoding="utf-8"
        )
        self.assertNotIn("HybridCostCalculator", form)
        self.assertNotIn("Αυτόματο κόστος & yield", form)
        self.assertNotIn("Ανανέωση ισοτιμιών", form)


if __name__ == "__main__":
    unittest.main()
