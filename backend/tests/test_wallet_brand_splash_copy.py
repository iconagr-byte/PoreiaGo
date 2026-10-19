"""Wallet brand splash copy stays quality-first (not marketing platform B2B)."""

from __future__ import annotations

from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPLASH_JS = ROOT / "src" / "lib" / "wallet" / "walletBrandSplash.js"


class WalletBrandSplashCopyTests(unittest.TestCase):
    def test_brand_and_hook_present(self):
        text = SPLASH_JS.read_text(encoding="utf-8")
        self.assertIn("PoreiaGo", text)
        self.assertIn("Κάθε διαδρομή, με σιγουριά.", text)
        self.assertIn("Ασφάλεια", text)
        self.assertIn("εμπιστοσύνη", text)
        self.assertNotIn("Αξιοπιστία σε κάθε διαδρομή", text)
        self.assertNotIn("η εμπειρία που αξίζει", text)
        self.assertIn("seenThisRuntime", text)
        self.assertIn("pg_wallet_apple_splash_v2", text)
        self.assertIn("pg_wallet_tabs_lostfound_in_account_v1", text)

    def test_not_b2b_office_platform_line(self):
        text = SPLASH_JS.read_text(encoding="utf-8")
        self.assertNotIn("ταξιδιωτικά γραφεία", text)
        self.assertNotIn("PLATFORM_TAGLINE", text)

    def test_app_wraps_native_splash_gate(self):
        app = (ROOT / "src" / "App.jsx").read_text(encoding="utf-8")
        self.assertIn("WalletNativeSplashGate", app)

    def test_html_boot_splash_and_login_fallback(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn("pg-wallet-boot-splash", html)
        login = (ROOT / "src" / "pages" / "LoginPage.jsx").read_text(encoding="utf-8")
        self.assertIn("WalletBrandSplash", login)
        auth = (ROOT / "src" / "lib" / "auth.js").read_text(encoding="utf-8")
        self.assertIn("resetWalletBrandSplash", auth)

    def test_native_shell_has_all_wallet_cards(self):
        shell = (ROOT / "src" / "components" / "wallet" / "WalletNativeShell.jsx").read_text(
            encoding="utf-8"
        )
        for label in ("Εισιτήριο", "Κρατήσεις", "Κράτηση", "Εγώ"):
            self.assertIn(label, shell)
        # Απωλεσθέντα moved into Εγώ — not a dock tab.
        self.assertNotIn("label: 'Απωλ.'", shell)
        self.assertIn("requiresRent", shell)
        wallet = (ROOT / "src" / "pages" / "SimpleWalletPage.jsx").read_text(encoding="utf-8")
        self.assertIn("Άνοιγμα απωλεσθέντων", wallet)
        self.assertIn("tenantId={sealedTenantId", wallet)


if __name__ == "__main__":
    unittest.main()
