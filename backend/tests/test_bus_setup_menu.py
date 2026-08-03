"""Master QR / PWA tools live in the buses hub menu, not buried under Drivers."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class BusSetupMenuContractTests(unittest.TestCase):
    def test_buses_hub_has_bus_setup_tab(self) -> None:
        hub = (ROOT / "src" / "lib" / "admin" / "busesHub.js").read_text(encoding="utf-8")
        self.assertIn("id: 'bus_setup'", hub)
        self.assertIn("Master QR & PWA", hub)

    def test_drivers_hub_no_longer_embeds_tools(self) -> None:
        drivers = (ROOT / "src" / "components" / "admin" / "DriversHub.jsx").read_text(
            encoding="utf-8"
        )
        self.assertNotIn("MasterQrPanel", drivers)
        self.assertNotIn("BusPwaInstallGuide", drivers)
        self.assertNotIn("Εργαλεία ταμπλό", drivers)

    def test_backoffice_renders_bus_setup(self) -> None:
        page = (ROOT / "src" / "pages" / "BackOffice.jsx").read_text(encoding="utf-8")
        self.assertIn("BusSetupTools", page)
        self.assertIn("activeTab === 'bus_setup'", page)


if __name__ == "__main__":
    unittest.main()
