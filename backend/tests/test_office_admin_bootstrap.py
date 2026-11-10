"""Office admin bootstrap — create / force-reset /admin/login for allowlisted offices."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

from travel_platform.settings import office_admin_bootstrap as mod


class OfficeAdminBootstrapTests(unittest.IsolatedAsyncioTestCase):
    async def test_invalid_args(self):
        result = await mod.ensure_office_admin_bootstrap(
            subdomain="",
            email="admin@example.com",
            password="short",
        )
        self.assertFalse(result["ok"])
        self.assertEqual(result["reason"], "invalid_args")

    async def test_repair_runs_allowlist(self):
        with patch.object(
            mod,
            "ensure_office_admin_bootstrap",
            new=AsyncMock(
                return_value={
                    "ok": True,
                    "action": "password_reset",
                    "subdomain": "dodopoulos-christos-charalampidis-achilleas-o-e",
                    "email": "axilleas0@yahoo.gr",
                }
            ),
        ) as ensure:
            out = await mod.repair_office_admin_bootstraps()
        self.assertTrue(out["ok"])
        self.assertEqual(len(out["reports"]), 1)
        ensure.assert_awaited()
        kwargs = ensure.await_args.kwargs
        self.assertEqual(
            kwargs["subdomain"],
            "dodopoulos-christos-charalampidis-achilleas-o-e",
        )
        self.assertEqual(kwargs["email"], "axilleas0@yahoo.gr")
        self.assertGreaterEqual(len(kwargs["password"]), 8)

    def test_allowlist_includes_dodopoulos(self):
        subs = {row["subdomain"] for row in mod._OFFICE_ADMIN_BOOTSTRAPS}
        self.assertIn("dodopoulos-christos-charalampidis-achilleas-o-e", subs)


if __name__ == "__main__":
    unittest.main()
