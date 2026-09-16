"""Contract: My Wallet PWA + offline last-pass snapshot."""

from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


class WalletPwaOfflineContractTests(unittest.TestCase):
    def test_wallet_sw_and_manifest_exist(self):
        sw = (ROOT / "public" / "wallet-pwa" / "sw.js").read_text(encoding="utf-8")
        self.assertIn("poreiago-wallet-v3", sw)
        self.assertIn("/wallet-pwa/offline.html", sw)
        self.assertIn("pathname.startsWith('/wallet')", sw)

        manifest = (ROOT / "public" / "wallet-pwa" / "manifest.webmanifest").read_text(
            encoding="utf-8"
        )
        self.assertIn('"start_url": "/wallet"', manifest)
        self.assertIn('"scope": "/wallet"', manifest)

        offline = (ROOT / "public" / "wallet-pwa" / "offline.html").read_text(encoding="utf-8")
        self.assertIn("wallet_last_pass_v1", offline)

        # Critical: no static directory at public/wallet (nginx would 403 /wallet).
        self.assertFalse((ROOT / "public" / "wallet").exists())

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
        self.assertIn("WalletAuthGate", page)
        self.assertIn("WalletAuthenticatedApp", page)
        reg = (ROOT / "src" / "lib" / "wallet" / "registerWalletPwa.js").read_text(
            encoding="utf-8"
        )
        self.assertIn("/wallet-pwa/sw.js", reg)

    def test_nginx_avoids_wallet_directory_trap(self):
        conf = (ROOT / "deploy" / "nginx" / "frontend.conf").read_text(encoding="utf-8")
        shared = (ROOT / "deploy" / "nginx" / "frontend-shared.inc").read_text(encoding="utf-8")
        # Host/XFH-based SPA shell (NPM may not preserve Host for server_name).
        self.assertIn("map $http_x_forwarded_host $spa_from_xfh", conf)
        self.assertIn("index.poreiago.html", conf)
        self.assertIn("set $spa_shell /index.html;", conf)
        self.assertIn("try_files $uri @seo_shell;", conf)
        self.assertIn("location @seo_shell", conf)
        self.assertIn("/api/site/seo-shell", conf)
        self.assertIn("frontend-shared.inc", conf)
        self.assertIn("Service-Worker-Allowed", shared)
        self.assertNotIn("try_files $uri $uri/ /index.html;", conf)
        self.assertNotIn("try_files $uri $uri/ $spa_shell;", conf)
        # Wallet deep links must hit the SPA shell, not a static /wallet/ directory.
        self.assertIn("location = /wallet", conf)
        self.assertIn("location ^~ /wallet/", conf)
        self.assertIn("location = /", conf)
        self.assertIn("proxy_pass http://$api_upstream/api/site/seo-shell;", conf)
        self.assertIn("location @seo_shell", conf)


if __name__ == "__main__":
    unittest.main()
