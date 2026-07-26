"""Contract: My Wallet PWA + offline last-pass snapshot."""

from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


class WalletPwaOfflineContractTests(unittest.TestCase):
    def test_wallet_sw_and_manifest_exist(self):
        sw = (ROOT / "public" / "wallet" / "sw.js").read_text(encoding="utf-8")
        self.assertIn("poreiago-wallet-v1", sw)
        self.assertIn("/wallet/offline.html", sw)
        self.assertIn("pathname.startsWith('/wallet')", sw)

        manifest = (ROOT / "public" / "wallet" / "manifest.webmanifest").read_text(
            encoding="utf-8"
        )
        self.assertIn('"start_url": "/wallet"', manifest)
        self.assertIn('"scope": "/wallet"', manifest)

        offline = (ROOT / "public" / "wallet" / "offline.html").read_text(encoding="utf-8")
        self.assertIn("wallet_last_pass_v1", offline)

    def test_last_pass_snapshot_helper(self):
        js = (ROOT / "src" / "lib" / "wallet" / "lastPassSnapshot.js").read_text(
            encoding="utf-8"
        )
        self.assertIn("WALLET_LAST_PASS_KEY", js)
        self.assertIn("saveLastPass", js)
        self.assertIn("loadLastPass", js)
        self.assertIn("patchLastPassQr", js)

    def test_wallet_page_registers_pwa(self):
        page = (ROOT / "src" / "pages" / "SimpleWalletPage.jsx").read_text(encoding="utf-8")
        self.assertIn("setupWalletPwa", page)
        self.assertIn("WalletInstallPrompt", page)
        self.assertIn("saveLastPass", page)


if __name__ == "__main__":
    unittest.main()
