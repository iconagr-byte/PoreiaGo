"""Public /api/site/contact — validation + honeypot."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.site_contact_router import router


class SiteContactRouterTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router)
        self.client = TestClient(app)

    def test_rejects_short_message(self):
        res = self.client.post(
            "/api/site/contact",
            json={
                "name": "Maria",
                "email": "maria@example.com",
                "message": "hi",
                "host": "www.achilliotravel.com",
            },
        )
        self.assertEqual(res.status_code, 422)

    def test_honeypot_pretends_success(self):
        with patch(
            "api.site_contact_router._resolve_office",
            new=AsyncMock(return_value=("tid", "info@achilliotravel.com", "Achillio")),
        ), patch("ticketing.email_dispatch.send_email", new=AsyncMock()) as send:
            res = self.client.post(
                "/api/site/contact",
                json={
                    "name": "Bot",
                    "email": "bot@example.com",
                    "message": "This is a long enough spam message.",
                    "website": "http://spam.example",
                    "host": "www.achilliotravel.com",
                },
            )
        self.assertEqual(res.status_code, 200)
        send.assert_not_called()

    def test_sends_to_office(self):
        with patch(
            "api.site_contact_router._resolve_office",
            new=AsyncMock(return_value=("tid", "info@achilliotravel.com", "Achillio Travel")),
        ), patch(
            "ticketing.email_dispatch.send_email",
            new=AsyncMock(return_value="email-ok"),
        ) as send:
            res = self.client.post(
                "/api/site/contact",
                json={
                    "name": "Μαρία Παπά",
                    "email": "maria@example.com",
                    "phone": "2100000000",
                    "subject": "Ερώτηση",
                    "message": "Θα ήθελα πληροφορίες για την εκδρομή στα Μετέωρα.",
                    "host": "www.achilliotravel.com",
                },
            )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json().get("ok"))
        send.assert_awaited_once()
        args, kwargs = send.await_args
        self.assertEqual(args[0], "info@achilliotravel.com")
        self.assertIn("Επικοινωνία", args[1])
        self.assertEqual(kwargs.get("tenant_id"), "tid")


if __name__ == "__main__":
    unittest.main()
