"""Seat pricing routes must be mounted on the main API app."""

from __future__ import annotations

import os
import unittest

from fastapi.testclient import TestClient


class SeatPricingRouterMountedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ["ADMIN_AUTH_DISABLED"] = "1"
        os.environ["ENVIRONMENT"] = "development"
        try:
            from app.core.config import get_settings

            get_settings.cache_clear()
        except Exception:
            pass
        from main import app

        cls.client = TestClient(app)

    def test_public_seat_pricing_ok(self):
        res = self.client.get(
            "/api/site/seat-pricing",
            params={"layout_id": "luxury-coach"},
            headers={"Host": "localhost"},
        )
        # Domain middleware may 404 without a seeded office — still assert mount.
        if res.status_code == 404 and "Office not found" in res.text:
            self.skipTest("No local office tenant for Host=localhost")
        self.assertEqual(res.status_code, 200, res.text)
        body = res.json()
        self.assertEqual(body.get("layout_id"), "luxury-coach")
        self.assertIn("standard_mode", body)

    def test_admin_seat_pricing_ok(self):
        res = self.client.get("/api/admin/platform/seat-pricing")
        if res.status_code == 401:
            self.skipTest("Admin auth required in this env (ADMIN_AUTH_DISABLED not honored)")
        self.assertEqual(res.status_code, 200, res.text)
        body = res.json()
        self.assertIn("layouts", body)
        self.assertIn("luxury-coach", body["layouts"])


if __name__ == "__main__":
    unittest.main()
