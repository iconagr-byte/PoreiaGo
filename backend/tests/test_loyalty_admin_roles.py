"""Loyalty admin gate must accept JWT `roles` list (not only singular `role`)."""

from __future__ import annotations

import unittest

from fastapi import HTTPException

from api.loyalty_router import _require_admin


class LoyaltyRequireAdminTests(unittest.TestCase):
    def test_accepts_tenant_admin_in_roles_list(self):
        _require_admin({"roles": ["tenant_admin", "dispatcher"]})

    def test_accepts_dispatcher_only(self):
        _require_admin({"roles": ["dispatcher"]})

    def test_accepts_legacy_singular_role(self):
        _require_admin({"role": "tenant_admin"})

    def test_rejects_customer(self):
        with self.assertRaises(HTTPException) as ctx:
            _require_admin({"roles": ["customer"]})
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("διαχειριστή", str(ctx.exception.detail))

    def test_rejects_empty_payload(self):
        with self.assertRaises(HTTPException) as ctx:
            _require_admin({})
        self.assertEqual(ctx.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
