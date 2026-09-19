"""Admin / backoffice password-reset tokens and public confirm path."""

from __future__ import annotations

import os
import unittest
from unittest.mock import patch

# Ensure JWT secret for token HMAC before first import of reset helpers.
os.environ.setdefault("AUTH_JWT_SECRET", "test-admin-password-reset-secret-32chars")


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

        token = create_reset_token(
            user_id="u1",
            tenant_id="",
            password_hash="hash",
        )
        bad = token[:-4] + ("AAAA" if not token.endswith("AAAA") else "BBBB")
        with self.assertRaises(ValueError):
            parse_reset_token(bad)

    def test_memory_user_send_and_confirm(self):
        from fastapi.testclient import TestClient

        from main import app
        from travel_platform.settings.admin_password_reset import (
            build_reset_url,
            create_reset_token,
        )
        from travel_platform.settings.users_store import create_user, get_user, list_users

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

        # Craft token directly (avoids auth middleware / SMTP). Confirm is public.
        token = create_reset_token(
            user_id=user.id,
            tenant_id="",
            password_hash=old_hash,
        )
        reset_url = build_reset_url(token)
        self.assertIn("/admin/reset-password?token=", reset_url)

        with patch.dict(
            os.environ,
            {
                "ADMIN_AUTH_DISABLED": "1",
                "ENVIRONMENT": "test",
                "AUTH_JWT_SECRET": "test-admin-password-reset-secret-32chars",
            },
            clear=False,
        ):
            client = TestClient(app)
            # Authenticated send path (dev admin context)
            send = client.post(
                f"/api/admin/platform/users/{user.id}/send-password-reset",
                json={},
            )
            self.assertEqual(send.status_code, 200, send.text)
            body = send.json()
            self.assertTrue(body.get("ok"))
            self.assertEqual(body.get("email"), email)

            confirm = client.post(
                "/api/admin/platform/password-reset/confirm",
                json={"token": token, "new_password": "newpass99"},
            )
            self.assertEqual(confirm.status_code, 200, confirm.text)

        updated = get_user(user.id)
        self.assertIsNotNone(updated)
        self.assertNotEqual(updated.password_hash, old_hash)

        # Old token must fail (fingerprint changed)
        with patch.dict(os.environ, {"ENVIRONMENT": "test"}, clear=False):
            client = TestClient(app)
            again = client.post(
                "/api/admin/platform/password-reset/confirm",
                json={"token": token, "new_password": "another99"},
            )
            self.assertEqual(again.status_code, 400)


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


if __name__ == "__main__":
    unittest.main()
