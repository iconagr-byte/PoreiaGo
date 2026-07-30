"""Smoke tests for tenant isolation hardening helpers."""

from __future__ import annotations

import os
import unittest
from unittest.mock import patch
from uuid import UUID


class TenantIsolationHardeningTests(unittest.TestCase):
    def test_file_store_prefixes_still_listed(self):
        from middleware.tenant import FILE_STORE_ADMIN_PREFIXES, _is_file_store_admin

        self.assertTrue(_is_file_store_admin("/api/admin/platform/drivers"))
        self.assertTrue(_is_file_store_admin("/api/admin/platform/fleet/vehicles"))
        self.assertTrue(_is_file_store_admin("/api/admin/platform/site-appearance"))
        self.assertTrue(_is_file_store_admin("/api/admin/platform/payment-settings"))
        self.assertIn("/api/admin/platform/drivers", FILE_STORE_ADMIN_PREFIXES)
        self.assertIn("/api/admin/platform/fleet", FILE_STORE_ADMIN_PREFIXES)
        self.assertIn("/api/admin/platform/payment-settings", FILE_STORE_ADMIN_PREFIXES)

    def test_live_fleet_merge_off_by_default(self):
        from travel_platform.telemetry.live_fleet import LiveFleetService

        svc = LiveFleetService()
        tid = UUID("11111111-1111-1111-1111-111111111111")
        with patch.dict(os.environ, {"ALLOW_CROSS_TENANT_FLEET_MERGE": ""}, clear=False):
            rows = svc.list_active_for_admin(tid)
        self.assertEqual(rows, [])

    def test_admin_ws_token_requires_roles(self):
        from api.ws_telemetry import _decode_admin_ws_token
        import jwt

        with patch.dict(os.environ, {"ADMIN_AUTH_DISABLED": ""}, clear=False):
            with self.assertRaises(jwt.InvalidTokenError):
                _decode_admin_ws_token(None)


if __name__ == "__main__":
    unittest.main()
