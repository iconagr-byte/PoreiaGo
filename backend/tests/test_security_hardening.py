"""Security: email/mailbox require admin JWT; magic-link never returns raw URL."""

from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.middleware.cors import CORSMiddleware

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("ADMIN_AUTH_DISABLED", "0")
os.environ.setdefault("AUTH_JWT_SECRET", "test-security-jwt-secret-32chars!!")


def _build_app() -> FastAPI:
    from api.customer_auth import router as customer_auth_router
    from api.email_settings_router import router as email_settings_router
    from middleware.tenant import TenantContextMiddleware

    app = FastAPI()
    app.add_middleware(TenantContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(email_settings_router)
    app.include_router(customer_auth_router)
    return app


class EmailApiAuthTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(_build_app())

    def test_email_settings_requires_bearer(self):
        res = self.client.get("/api/email/settings")
        self.assertEqual(res.status_code, 401)
        self.assertIn("Missing bearer", res.json().get("detail", ""))

    def test_email_settings_create_requires_bearer(self):
        res = self.client.post(
            "/api/email/settings",
            json={
                "email_address": "a@b.gr",
                "imap_host": "mail.b.gr",
                "smtp_host": "mail.b.gr",
                "mail_password": "secret",
            },
        )
        self.assertEqual(res.status_code, 401)


class WalletMagicHardeningTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(_build_app())

    def test_issue_never_returns_magic_url(self):
        with patch("api.customer_auth.create_wallet_magic_token", return_value="tok123"), patch(
            "api.customer_auth.send_email", return_value="ok"
        ):
            res = self.client.post(
                "/api/auth/wallet-magic/issue",
                json={
                    "email": "passenger@example.com",
                    "booking_id": "B-1",
                    "send_email": False,
                },
            )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body.get("ok"))
        self.assertNotIn("magic_url", body)
        self.assertNotIn("tok123", str(body))


class AdminAuthDisabledProdGuardTests(unittest.TestCase):
    def test_disabled_flag_ignored_outside_dev(self):
        from middleware.tenant import _admin_auth_disabled_allowed

        with patch.dict(os.environ, {"ENVIRONMENT": "production"}, clear=False):
            self.assertFalse(_admin_auth_disabled_allowed())
        with patch.dict(os.environ, {"ENVIRONMENT": "development"}, clear=False):
            self.assertTrue(_admin_auth_disabled_allowed())


if __name__ == "__main__":
    unittest.main()
