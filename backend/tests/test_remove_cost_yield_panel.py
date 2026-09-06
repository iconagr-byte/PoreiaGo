"""Contract: Trip form no longer shows unused hybrid cost/rebook panels."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class RemoveHybridTripPanelsTests(unittest.TestCase):
    def test_trip_form_drops_cost_yield_supplier_rebook(self) -> None:
        form = (ROOT / "src" / "components" / "admin" / "TripForm.jsx").read_text(
            encoding="utf-8"
        )
        self.assertNotIn("HybridCostCalculator", form)
        self.assertNotIn("Αυτόματο κόστος & yield", form)
        self.assertNotIn("Ανανέωση ισοτιμιών", form)
        self.assertNotIn("HybridSupplierCosts", form)
        self.assertNotIn("Supplier cost sheets", form)
        self.assertNotIn("HybridRebookWhatsApp", form)
        self.assertNotIn("Rebook & WhatsApp templates", form)


if __name__ == "__main__":
    unittest.main()
