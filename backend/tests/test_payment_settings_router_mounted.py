"""Payment settings API must be mounted on the production main:app."""

from __future__ import annotations

import unittest


class PaymentSettingsRouterMountedTests(unittest.TestCase):
    def test_main_app_exposes_admin_and_public_payment_settings(self):
        from main import app

        paths = {getattr(r, "path", None) for r in app.routes}
        self.assertIn("/api/admin/platform/payment-settings", paths)
        self.assertIn("/api/site/payment-settings", paths)
        self.assertIn("/api/admin/platform/bank-accounts", paths)


if __name__ == "__main__":
    unittest.main()
