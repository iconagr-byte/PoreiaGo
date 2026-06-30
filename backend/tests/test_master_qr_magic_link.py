"""Tests for Master QR magic link + PNG."""

from __future__ import annotations

import os
import unittest

from travel_platform.operations.master_qr_image import render_qr_png
from travel_platform.operations.master_qr_normalize import (
    build_driver_auth_url,
    normalize_master_qr_input,
)


class MasterQrNormalizeTests(unittest.TestCase):
    def test_build_auth_url(self) -> None:
        url = build_driver_auth_url("mq1.abc123", base_url="https://app.example.com")
        self.assertIn("https://app.example.com/driver/auth?token=", url)
        self.assertIn("mq1.abc123", url)

    def test_normalize_magic_link(self) -> None:
        raw = "https://travel.example.com/driver/auth?token=mq1.testtoken"
        self.assertEqual(normalize_master_qr_input(raw), "mq1.testtoken")

    def test_normalize_passthrough_mq1(self) -> None:
        self.assertEqual(normalize_master_qr_input("mq1.jwt.here"), "mq1.jwt.here")


class MasterQrImageTests(unittest.TestCase):
    def test_render_png_bytes(self) -> None:
        try:
            png = render_qr_png("https://example.com/driver/auth?token=mq1.test")
        except ImportError:
            self.skipTest("qrcode not installed")
        self.assertTrue(png.startswith(b"\x89PNG"))


class MasterQrLocalIssueTests(unittest.TestCase):
    def test_issue_returns_auth_url(self) -> None:
        os.environ["AUTH_JWT_SECRET"] = "dev-jwt-secret-change-in-prod-32bytes!!"
        from travel_platform.operations.master_qr_local import issue_master_qr

        result = issue_master_qr(99, tenant_id="00000000-0000-0000-0000-000000000001")
        self.assertIn("/driver/auth?token=", result["auth_url"])
        self.assertTrue(result["qr_token"].startswith("mq1."))
        self.assertEqual(result["qr_content"], result["auth_url"])


if __name__ == "__main__":
    unittest.main()
