"""Customer JWT seals My Wallet to one office — no cross-office bleed."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException

from api.customer_wallet_seal import (
    jwt_tenant_id,
    resolve_login_wallet_tenant,
    resolve_sealed_wallet_tenant,
)
from ticketing.customer_jwt import create_customer_token, decode_customer_token


class CustomerJwtTenantStampTests(unittest.TestCase):
    def test_token_carries_tenant_id(self):
        token = create_customer_token(
            "a@example.com",
            extra={"tenant_id": "11111111-1111-1111-1111-111111111111"},
        )
        payload = decode_customer_token(token)
        self.assertEqual(payload["sub"], "a@example.com")
        self.assertEqual(jwt_tenant_id(payload), "11111111-1111-1111-1111-111111111111")

    def test_account_home_office(self):
        self.assertEqual(
            jwt_tenant_id({"wallet_tenant_id": "office-home"}),
            "office-home",
        )


class ResolveSealedWalletTenantTests(unittest.IsolatedAsyncioTestCase):
    async def test_jwt_and_host_match(self):
        req = MagicMock()
        with patch(
            "api.request_tenant.public_tenant_id",
            new=AsyncMock(return_value="office-a"),
        ):
            out = await resolve_sealed_wallet_tenant(req, jwt_tid="office-a")
        self.assertEqual(out, "office-a")

    async def test_mismatch_rejected(self):
        req = MagicMock()
        with patch(
            "api.request_tenant.public_tenant_id",
            new=AsyncMock(return_value="office-b"),
        ):
            with self.assertRaises(HTTPException) as ctx:
                await resolve_sealed_wallet_tenant(req, jwt_tid="office-a")
        self.assertEqual(ctx.exception.status_code, 403)

    async def test_jwt_only_for_native(self):
        req = MagicMock()
        with patch(
            "api.request_tenant.public_tenant_id",
            new=AsyncMock(return_value=None),
        ):
            out = await resolve_sealed_wallet_tenant(req, jwt_tid="office-a")
        self.assertEqual(out, "office-a")

    async def test_host_only_legacy_token(self):
        req = MagicMock()
        with patch(
            "api.request_tenant.public_tenant_id",
            new=AsyncMock(return_value="office-a"),
        ):
            out = await resolve_sealed_wallet_tenant(req, jwt_tid=None)
        self.assertEqual(out, "office-a")


class ResolveLoginWalletTenantTests(unittest.IsolatedAsyncioTestCase):
    async def test_host_binds_home(self):
        req = MagicMock()
        bind = AsyncMock(return_value={"email": "a@x.com", "wallet_tenant_id": "office-a"})
        with (
            patch(
                "api.customer_wallet_seal.stamp_tenant_for_request",
                new=AsyncMock(return_value="office-a"),
            ),
            patch("ticketing.customer_accounts.bind_wallet_tenant", new=bind),
        ):
            out = await resolve_login_wallet_tenant(
                req, account={"email": "a@x.com", "wallet_tenant_id": None}
            )
        self.assertEqual(out, "office-a")
        bind.assert_awaited_once()

    async def test_native_reuses_home_office(self):
        req = MagicMock()
        with (
            patch(
                "api.customer_wallet_seal.stamp_tenant_for_request",
                new=AsyncMock(return_value=None),
            ),
            patch(
                "ticketing.customer_accounts.bind_wallet_tenant",
                new=AsyncMock(),
            ),
        ):
            out = await resolve_login_wallet_tenant(
                req,
                account={
                    "email": "a@x.com",
                    "wallet_tenant_id": "office-a",
                },
            )
        self.assertEqual(out, "office-a")

    async def test_host_home_mismatch_forbidden(self):
        req = MagicMock()
        with patch(
            "api.customer_wallet_seal.stamp_tenant_for_request",
            new=AsyncMock(return_value="office-b"),
        ):
            with self.assertRaises(HTTPException) as ctx:
                await resolve_login_wallet_tenant(
                    req,
                    account={
                        "email": "a@x.com",
                        "wallet_tenant_id": "office-a",
                    },
                )
        self.assertEqual(ctx.exception.status_code, 403)

    async def test_no_office_refused(self):
        req = MagicMock()
        with patch(
            "api.customer_wallet_seal.stamp_tenant_for_request",
            new=AsyncMock(return_value=None),
        ):
            with self.assertRaises(HTTPException) as ctx:
                await resolve_login_wallet_tenant(
                    req, account={"email": "a@x.com", "wallet_tenant_id": None}
                )
        self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
