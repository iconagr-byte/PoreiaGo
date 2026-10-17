"""Google ID-token audiences: PoreiaGo + legacy Achillio Web clients."""

from __future__ import annotations

import os
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException


class GoogleOAuthAudienceTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self._prev = {
            k: os.environ.get(k)
            for k in ("GOOGLE_CLIENT_ID", "VITE_GOOGLE_CLIENT_ID")
        }
        os.environ.pop("GOOGLE_CLIENT_ID", None)
        os.environ.pop("VITE_GOOGLE_CLIENT_ID", None)

    def tearDown(self):
        for k, v in self._prev.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    def test_builtin_audiences_include_poreiago_and_legacy(self):
        from app.services.google_oauth import (
            _LEGACY_ACHILLIO_WEB_CLIENT_ID,
            _POREIAGO_WALLET_WEB_CLIENT_ID,
            google_client_ids,
        )

        ids = google_client_ids()
        self.assertIn(_POREIAGO_WALLET_WEB_CLIENT_ID, ids)
        self.assertIn(_LEGACY_ACHILLIO_WEB_CLIENT_ID, ids)

    async def test_legacy_achillio_aud_accepted(self):
        from app.services.google_oauth import (
            _LEGACY_ACHILLIO_WEB_CLIENT_ID,
            verify_google_id_token,
        )

        fake = MagicMock()
        fake.status_code = 200
        fake.json.return_value = {
            "aud": _LEGACY_ACHILLIO_WEB_CLIENT_ID,
            "email": "user@example.com",
            "email_verified": "true",
        }
        cm = MagicMock()
        cm.__aenter__ = AsyncMock(return_value=MagicMock(get=AsyncMock(return_value=fake)))
        cm.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.google_oauth.httpx.AsyncClient", return_value=cm):
            data = await verify_google_id_token("fake.jwt")
        self.assertEqual(data["email"], "user@example.com")

    async def test_unknown_aud_rejected(self):
        from app.services.google_oauth import verify_google_id_token

        fake = MagicMock()
        fake.status_code = 200
        fake.json.return_value = {
            "aud": "999999999999-unknown.apps.googleusercontent.com",
            "email": "user@example.com",
            "email_verified": "true",
        }
        cm = MagicMock()
        cm.__aenter__ = AsyncMock(return_value=MagicMock(get=AsyncMock(return_value=fake)))
        cm.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.google_oauth.httpx.AsyncClient", return_value=cm):
            with self.assertRaises(HTTPException) as ctx:
                await verify_google_id_token("fake.jwt")
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("audience mismatch", ctx.exception.detail)


if __name__ == "__main__":
    unittest.main()
