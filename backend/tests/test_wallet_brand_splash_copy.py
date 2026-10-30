"""Wallet brand splash is generic: PoreiaGo wordmark only (no marketing copy)."""

from __future__ import annotations

from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPLASH_JS = ROOT / "src" / "lib" / "wallet" / "walletBrandSplash.js"
SPLASH_JSX = ROOT / "src" / "components" / "wallet" / "WalletBrandSplash.jsx"


class WalletBrandSplashCopyTests(unittest.TestCase):
    def test_brand_only_no_greek_marketing(self):
        text = SPLASH_JS.read_text(encoding="utf-8")
        self.assertIn("PoreiaGo", text)
        self.assertIn("WALLET_SPLASH_BRAND", text)
        self.assertIn("seenThisRuntime", text)
        self.assertNotIn("Τα εισιτήριά σας", text)
        self.assertNotIn("Επιβίβαση με ένα άγγιγμα", text)
        self.assertNotIn("WALLET_SPLASH_HOOK", text)
        self.assertNotIn("WALLET_SPLASH_SUPPORT", text)

    def test_component_renders_wordmark_only(self):
        jsx = SPLASH_JSX.read_text(encoding="utf-8")
        self.assertIn("pg-wallet-splash-wordmark", jsx)
        self.assertNotIn("pg-wallet-splash-hook", jsx)
        self.assertNotIn("Αγγίξτε για συνέχεια", jsx)

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
