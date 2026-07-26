"""Contract: device-save helpers + wallet-pass status endpoint wiring."""

from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


class WalletDeviceSaveContractTests(unittest.TestCase):
    def test_frontend_device_save_helpers_exist(self):
        js = (ROOT / "src" / "lib" / "wallet" / "deviceSave.js").read_text(encoding="utf-8")
        self.assertIn("buildBookingIcs", js)
        self.assertIn("downloadBookingIcs", js)
        self.assertIn("googleCalendarUrl", js)
        self.assertIn("shareBooking", js)

    def test_backend_status_endpoint_mentions_apple_env(self):
        py = (ROOT / "backend" / "api" / "customer_bookings.py").read_text(encoding="utf-8")
        self.assertIn("/api/customer/wallet-pass/status", py)
        self.assertIn("APPLE_PASS_TYPE_ID", py)
        self.assertIn("_apple_wallet_configured", py)


if __name__ == "__main__":
    unittest.main()
