"""Contract: per-office My Wallet QR on dashboard."""

from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


class OfficeWalletQrContractTests(unittest.TestCase):
    def test_public_url_helper(self):
        js = (ROOT / "src" / "lib" / "platform" / "officePublicUrl.js").read_text(
            encoding="utf-8"
        )
        self.assertIn("getOfficePublicOrigin", js)
        self.assertIn("getOfficeWalletUrl", js)
        self.assertIn("normalizePublicHost", js)
        self.assertIn("/wallet", js)

    def test_dashboard_card_mounted(self):
        card = (ROOT / "src" / "components" / "admin" / "OfficeWalletShareCard.jsx").read_text(
            encoding="utf-8"
        )
        self.assertIn("getOfficeWalletUrl", card)
        self.assertIn("QRCode", card)
        self.assertIn("My Wallet", card)

        page = (ROOT / "src" / "pages" / "BackOffice.jsx").read_text(encoding="utf-8")
        self.assertIn("OfficeWalletShareCard", page)


if __name__ == "__main__":
    unittest.main()
