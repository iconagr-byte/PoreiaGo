"""Contract: Achilleas home office is PoreiaGo platform, not Achillio Travel."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class PoreiagoHomeDriverContractTests(unittest.TestCase):
    def test_store_targets_poreiago(self) -> None:
        store = (
            ROOT / "backend" / "travel_platform" / "settings" / "drivers_store.py"
        ).read_text(encoding="utf-8")
        self.assertIn("repair_poreiago_home_drivers", store)
        self.assertIn("_POREIAGO_HOME_EMAILS", store)
        self.assertIn("axilleas0@yahoo.gr", store)
        # Must not keep the old Achillio-home repair body.
        self.assertNotIn(
            "known Achillio drivers must not stay on PoreiaGo",
            store,
        )

    def test_drivers_list_soft_ensures_achilleas(self) -> None:
        api = (ROOT / "backend" / "api" / "admin_platform.py").read_text(encoding="utf-8")
        self.assertIn("ensure_home_driver_on_tenant", api)
        self.assertIn("_POREIAGO_HOME_EMAILS", api)
        self.assertIn("_tenant_is_poreiago_platform", api)
        self.assertIn("DEMO JWT / Achillio JWT / platform JWT", api)

    def test_deploy_and_boot_call_poreiago_repair(self) -> None:
        main = (ROOT / "backend" / "main.py").read_text(encoding="utf-8")
        deploy = (ROOT / "deploy" / "scripts" / "vm-deploy-all.sh").read_text(
            encoding="utf-8"
        )
        self.assertIn("repair_poreiago_home_drivers", main)
        self.assertIn("repair_poreiago_home_drivers", deploy)
        self.assertIn("PoreiaGo platform", deploy)
        self.assertNotIn("Ensure Achilleas home driver on Achillio Travel", deploy)

    def test_panel_says_poreiago(self) -> None:
        panel = (
            ROOT / "src" / "components" / "admin" / "DriversManagementPanel.jsx"
        ).read_text(encoding="utf-8")
        self.assertIn("PoreiaGo", panel)
        self.assertIn("Αχιλλέας", panel)


if __name__ == "__main__":
    unittest.main()
