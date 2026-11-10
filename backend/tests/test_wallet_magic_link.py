"""My Wallet magic-link tokens — issue + single-use consume."""

from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from ticketing import wallet_magic as magic


class WalletMagicTests(unittest.IsolatedAsyncioTestCase):
    async def test_create_and_consume_once(self):
        account = {
            "email": "guest@example.com",
            "name": "Guest",
            "phone": "",
            "picture": "",
            "auth_provider": "magic",
            "customer_id": "CUST-001",
            "has_password": False,
        }
        stored = {}

        async def execute(sql, params=()):
            sql_n = " ".join(sql.split()).lower()
            if sql_n.startswith("insert into wallet_magic_tokens"):
                stored["row"] = {
                    "token": params[0],
                    "email": params[1],
                    "booking_id": params[2],
                    "expires_at": params[3],
                    "used_at": None,
                    "created_at": params[4],
                }
                return MagicMock()
            if "from wallet_magic_tokens where token" in sql_n:
                result = MagicMock()
                row = stored.get("row")
                if row and row["token"] == params[0]:
                    result.fetchone = AsyncMock(return_value=row)
                else:
                    result.fetchone = AsyncMock(return_value=None)
                return result
            if sql_n.startswith("update wallet_magic_tokens set used_at"):
                if stored.get("row") and stored["row"]["token"] == params[1]:
                    stored["row"]["used_at"] = params[0]
                return MagicMock()
            return MagicMock()

        db = MagicMock()
        db.execute = AsyncMock(side_effect=execute)
        db.commit = AsyncMock()

        with patch.object(magic, "get_db", return_value=db), patch.object(
            magic,
            "ensure_magic_account",
            new=AsyncMock(return_value=account),
        ), patch.object(magic, "get_account", new=AsyncMock(return_value=account)):
            token = await magic.create_wallet_magic_token(
                email="guest@example.com",
                booking_id="BK-TEST1",
                name="Guest",
            )
            self.assertTrue(token)
            first = await magic.consume_wallet_magic_token(token)
            self.assertEqual(first["booking_id"], "BK-TEST1")
            self.assertEqual(first["account"]["email"], "guest@example.com")

            with self.assertRaises(ValueError):
                await magic.consume_wallet_magic_token(token)

    async def test_expired_token_rejected(self):
        expired = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
        row = {
            "token": "abc1234567890",
            "email": "guest@example.com",
            "booking_id": "BK-1",
            "expires_at": expired,
            "used_at": None,
        }
        result = MagicMock()
        result.fetchone = AsyncMock(return_value=row)
        db = MagicMock()
        db.execute = AsyncMock(return_value=result)
        db.commit = AsyncMock()

        with patch.object(magic, "get_db", return_value=db):
            with self.assertRaises(ValueError):
                await magic.consume_wallet_magic_token("abc1234567890")


if __name__ == "__main__":
    unittest.main()
