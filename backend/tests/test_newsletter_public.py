"""Public newsletter subscribe endpoint."""

from __future__ import annotations

import os
import unittest
from unittest.mock import AsyncMock, patch

os.environ.setdefault("ADMIN_AUTH_DISABLED", "1")
os.environ.setdefault("ENVIRONMENT", "test")


def _build_app():
    from main import app

    return app


class NewsletterPublicTests(unittest.TestCase):
    def setUp(self):
        from fastapi.testclient import TestClient

        self.client = TestClient(_build_app())

    def test_subscribe_requires_consent(self):
        res = self.client.post(
            "/api/newsletter/subscribe",
            json={"email": "guest@example.com", "consent": False, "source": "trips"},
        )
        self.assertEqual(res.status_code, 400)

    def test_subscribe_rejects_bad_email(self):
        res = self.client.post(
            "/api/newsletter/subscribe",
            json={"email": "not-an-email", "consent": True, "source": "trips"},
        )
        self.assertEqual(res.status_code, 400)

    def test_subscribe_ok(self):
        fake = {
            "id": "SUB-1",
            "email": "guest@example.com",
            "customer_id": "nl-trips",
            "name": "Αθήνα",
            "is_subscribed": True,
        }
        with patch(
            "api.newsletter_public_router.email_store.ensure_subscriber",
            new_callable=AsyncMock,
            return_value=fake,
        ):
            res = self.client.post(
                "/api/newsletter/subscribe",
                json={
                    "email": "guest@example.com",
                    "preferred_city": "Αθήνα",
                    "consent": True,
                    "source": "trips",
                },
            )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body.get("ok"))
        self.assertEqual(body.get("email"), "guest@example.com")


if __name__ == "__main__":
    unittest.main()
