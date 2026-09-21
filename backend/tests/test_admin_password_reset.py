"""Admin / backoffice password-reset — crypto, public confirm, rate limit."""

from __future__ import annotations

import os
import unittest
from unittest.mock import patch

os.environ.setdefault("AUTH_JWT_SECRET", "test-admin-password-reset-secret-32chars!!")


class AdminPasswordResetTokenTests(unittest.TestCase):
    def test_token_roundtrip_and_fingerprint(self):
        from travel_platform.settings.admin_password_reset import (
            create_reset_token,
            parse_reset_token,
            password_fingerprint,
        )

        token = create_reset_token(
            user_id="11111111-1111-1111-1111-111111111111",
            tenant_id="22222222-2222-2222-2222-222222222222",
            password_hash="pbkdf2_sha256$salt$digest",
        )
        parsed = parse_reset_token(token)
        self.assertEqual(parsed["user_id"], "11111111-1111-1111-1111-111111111111")
        self.assertEqual(parsed["tenant_id"], "22222222-2222-2222-2222-222222222222")
        self.assertEqual(
            parsed["fingerprint"],
            password_fingerprint("pbkdf2_sha256$salt$digest"),
        )

    def test_tampered_token_rejected(self):
        from travel_platform.settings.admin_password_reset import (
            create_reset_token,
            parse_reset_token,
        )

        token = create_reset_token(user_id="u1", tenant_id="", password_hash="hash")
        bad = token[:-4] + ("AAAA" if not token.endswith("AAAA") else "BBBB")
        with self.assertRaises(ValueError):
            parse_reset_token(bad)

    def test_password_policy(self):
        from travel_platform.settings.admin_password_reset import validate_new_admin_password

        with self.assertRaises(ValueError):
            validate_new_admin_password("short")
        with self.assertRaises(ValueError):
            validate_new_admin_password("onlyletters")
        with self.assertRaises(ValueError):
            validate_new_admin_password("12345678")
        self.assertEqual(validate_new_admin_password("goodPass1"), "goodPass1")

    def test_html_escape_in_email(self):
        import asyncio
        from unittest.mock import AsyncMock

        from travel_platform.settings import admin_password_reset as mod

        captured = {}

        async def fake_send(to, subject, body_html, **kwargs):
            captured["html"] = body_html
            return "ref"

        async def _run():
            with patch("ticketing.email_dispatch.send_email", new=AsyncMock(side_effect=fake_send)):
                await mod.send_admin_reset_email(
                    to_email="a@b.com",
                    full_name="<script>alert(1)</script>",
                    reset_url="https://x.example/admin/reset-password?token=abc",
                )

        asyncio.run(_run())
        self.assertNotIn("<script>", captured["html"])
        self.assertIn("&lt;script&gt;", captured["html"])

    def test_memory_user_send_and_confirm(self):
        from fastapi.testclient import TestClient

        from main import app
        from travel_platform.settings.admin_password_reset import (
            build_reset_url,
            create_reset_token,
            reset_confirm_rate_limits_for_tests,
        )
        from travel_platform.settings.users_store import create_user, get_user, list_users

        reset_confirm_rate_limits_for_tests()
        email = "reset-demo@example.com"
        for u in list(list_users()):
            if u.email == email:
                from travel_platform.settings.users_store import delete_user

                try:
                    delete_user(u.id)
                except Exception:
                    pass
        user = create_user(
            email=email,
            name="Reset Demo",
            role="admin",
            password="oldpass99",
        )
        old_hash = user.password_hash
        token = create_reset_token(
            user_id=user.id,
            tenant_id="",
            password_hash=old_hash,
        )
        self.assertIn("/admin/reset-password?token=", build_reset_url(token))

        with patch.dict(
            os.environ,
            {
                "ADMIN_AUTH_DISABLED": "1",
                "ENVIRONMENT": "test",
                "AUTH_JWT_SECRET": "test-admin-password-reset-secret-32chars!!",
            },
            clear=False,
        ):
            client = TestClient(app)
            send = client.post(
                f"/api/admin/platform/users/{user.id}/send-password-reset",
                json={},
            )
            self.assertEqual(send.status_code, 200, send.text)
            body = send.json()
            self.assertTrue(body.get("ok"))
            # tenant_admin path in dev: reset_url only for superadmin — may be null
            confirm = client.post(
                "/api/admin/platform/password-reset/confirm",
                json={"token": token, "new_password": "newpass99"},
            )
            self.assertEqual(confirm.status_code, 200, confirm.text)

        updated = get_user(user.id)
        self.assertIsNotNone(updated)
        self.assertNotEqual(updated.password_hash, old_hash)

        with patch.dict(os.environ, {"ENVIRONMENT": "test"}, clear=False):
            client = TestClient(app)
            again = client.post(
                "/api/admin/platform/password-reset/confirm",
                json={"token": token, "new_password": "another99"},
            )
            self.assertEqual(again.status_code, 400)

    def test_confirm_rate_limit(self):
        from travel_platform.settings.admin_password_reset import (
            allow_confirm_attempt,
            reset_confirm_rate_limits_for_tests,
        )

        reset_confirm_rate_limits_for_tests()
        key = "203.0.113.9"
        for _ in range(10):
            self.assertTrue(allow_confirm_attempt(key))
        self.assertFalse(allow_confirm_attempt(key))


class AdminPasswordResetPublicPathTests(unittest.TestCase):
    def test_confirm_is_public_in_middleware(self):
        from middleware.tenant import ADMIN_PUBLIC_POST_PREFIXES, _admin_public_post

        self.assertTrue(
            any(
                p.startswith("/api/admin/platform/password-reset/confirm")
                for p in ADMIN_PUBLIC_POST_PREFIXES
            )
        )
        self.assertTrue(
            _admin_public_post("/api/admin/platform/password-reset/confirm", "POST")
        )
        self.assertFalse(
            _admin_public_post("/api/admin/platform/password-reset/send", "POST")
        )

    def test_memory_fallback_blocked_in_production(self):
        from travel_platform.settings.admin_password_reset import memory_fallback_allowed

        with patch.dict(os.environ, {"ENVIRONMENT": "production"}, clear=False):
            self.assertFalse(memory_fallback_allowed())
        with patch.dict(os.environ, {"ENVIRONMENT": "test"}, clear=False):
            self.assertTrue(memory_fallback_allowed())


if __name__ == "__main__":
    unittest.main()
