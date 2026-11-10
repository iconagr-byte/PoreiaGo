"""Contract: Achilleas stays visible for Achillio JWT; PoreiaGo empty state explains."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class DriversVisibilityContractTests(unittest.TestCase):
    def test_drivers_list_keeps_achillio_jwt(self) -> None:
        api = (ROOT / "backend" / "api" / "admin_platform.py").read_text(encoding="utf-8")
        self.assertIn("Achillio Travel JWT → always that office", api)
        self.assertNotIn(
            "SEAL: Achillio JWT on PoreiaGo page remapped to platform for drivers",
            api,
        )
        self.assertIn("await _tenant_is_achillio_office(jwt_tid)", api)

    def test_empty_state_points_to_achillio(self) -> None:
        panel = (
            ROOT / "src" / "components" / "admin" / "DriversManagementPanel.jsx"
        ).read_text(encoding="utf-8")
        self.assertIn("www.achilliotravel.com/admin/drivers", panel)
        self.assertIn("isPoreiagoHost", panel)
        self.assertIn("Αχιλλέας", panel)


if __name__ == "__main__":
    unittest.main()
