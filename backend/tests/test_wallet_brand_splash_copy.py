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
        self.assertIn("Αξιοπιστία σε κάθε διαδρομή", text)
        self.assertIn("Ασφάλεια", text)
        self.assertIn("εμπιστοσύνη", text)
        self.assertIn("seenThisRuntime", text)

    def test_not_b2b_office_platform_line(self):
        text = SPLASH_JS.read_text(encoding="utf-8")
        self.assertNotIn("ταξιδιωτικά γραφεία", text)
        self.assertNotIn("PLATFORM_TAGLINE", text)

    def test_app_wraps_native_splash_gate(self):
        app = (ROOT / "src" / "App.jsx").read_text(encoding="utf-8")
        self.assertIn("WalletNativeSplashGate", app)

    def test_unified_splash_gate_not_skipped_on_driver_path(self):
        """After unify (#838), cold start may land on /driver — still show brand splash."""
        gate = (
            ROOT / "src" / "components" / "wallet" / "WalletNativeSplashGate.jsx"
        ).read_text(encoding="utf-8")
        self.assertNotIn("isDriverSurface", gate)
        self.assertIn("isNativeDriverApp", gate)
        self.assertIn("hideNativeSplash", gate)
        self.assertIn("SPLASH_FAILSAFE_MS", gate)


if __name__ == "__main__":
    unittest.main()
