"""Contract: passwordless login QR on driver profile account section."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class DriverLoginQrPanelContractTests(unittest.TestCase):
    def test_panel_component_exists(self) -> None:
        panel = (ROOT / "src" / "components" / "admin" / "DriverLoginQrPanel.jsx").read_text(
            encoding="utf-8"
        )
        self.assertIn("issueMasterQr", panel)
        self.assertIn("Σύνδεση χωρίς κωδικό", panel)
        self.assertIn("QRCode", panel)

    def test_driver_detail_embeds_panel(self) -> None:
        page = (ROOT / "src" / "pages" / "admin" / "DriverDetailPage.jsx").read_text(
            encoding="utf-8"
        )
        self.assertIn("DriverLoginQrPanel", page)
        self.assertIn("Δοκιμή εφαρμογής", page)


if __name__ == "__main__":
    unittest.main()
