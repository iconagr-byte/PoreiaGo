"""Contract: passwordless login QR lives under Master QR & PWA, not driver profile."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class DriverLoginQrLocationContractTests(unittest.TestCase):
    def test_embedded_panel_removed(self) -> None:
        panel = ROOT / "src" / "components" / "admin" / "DriverLoginQrPanel.jsx"
        self.assertFalse(panel.exists(), "DriverLoginQrPanel must stay removed (use Master QR & PWA)")

    def test_driver_detail_points_to_master_qr_menu(self) -> None:
        page = (ROOT / "src" / "pages" / "admin" / "DriverDetailPage.jsx").read_text(
            encoding="utf-8"
        )
        self.assertNotIn("DriverLoginQrPanel", page)
        # JSX may encode & as &amp;
        self.assertTrue(
            "Master QR & PWA" in page or "Master QR &amp; PWA" in page,
            "driver detail must point to Master QR & PWA menu",
        )
        self.assertIn("bus_setup", page)
        self.assertIn("Δοκιμή εφαρμογής", page)

    def test_master_qr_panel_still_issues_qr(self) -> None:
        panel = (ROOT / "src" / "components" / "admin" / "MasterQrPanel.jsx").read_text(
            encoding="utf-8"
        )
        self.assertIn("issueMasterQr", panel)
        self.assertIn("QRCode", panel)


if __name__ == "__main__":
    unittest.main()
