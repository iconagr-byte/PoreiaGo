"""poreiago.com login must open PoreiaGo — not reject Achillio Travel emails."""

from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.models.user import UserRole
from app.services.auth_service import AuthService, hash_password


class PlatformLoginMirrorTests(unittest.IsolatedAsyncioTestCase):
    async def test_mirrors_achillio_admin_onto_poreiago_tenant(self):
        achillio_tid = uuid4()
        poreiago_tid = uuid4()
        password = "Secret123!"
        pw_hash = hash_password(password)

        source = SimpleNamespace(
            id=uuid4(),
            tenant_id=achillio_tid,
            email="axilleas0@yahoo.gr",
            password_hash=pw_hash,
            full_name="Axilleas",
            roles=[UserRole.TENANT_ADMIN.value],
            is_active=True,
        )

        session = AsyncMock()
        # _match_users → source; tenant lookup for classifier; existing user miss; flush
        match_result = MagicMock()
        match_result.scalars.return_value.all.return_value = [source]

        achillio_tenant = SimpleNamespace(
            id=achillio_tid,
            slug="admin-achillio-gr",
            subdomain="admin-achillio-gr",
            custom_domain="achilliotravel.com",
            legal_name="Achillio Travel",
        )
        tenant_result = MagicMock()
        tenant_result.scalar_one_or_none.return_value = achillio_tenant

        existing_result = MagicMock()
        existing_result.scalar_one_or_none.return_value = None

        session.execute = AsyncMock(
            side_effect=[
                MagicMock(),  # SET LOCAL row_security
                match_result,
                tenant_result,
                MagicMock(),  # SET LOCAL again
                existing_result,
            ],
        )
        session.add = MagicMock()
        session.flush = AsyncMock()

        with patch(
            "app.services.tenant_modules.is_achillio_travel_office",
            return_value=True,
        ):
            service = AuthService(session)
            user = await service._mirror_user_onto_tenant(
                target_tenant_id=poreiago_tid,
                email="axilleas0@yahoo.gr",
                password=password,
            )

        self.assertIsNotNone(user)
        self.assertEqual(user.tenant_id, poreiago_tid)
        self.assertEqual(user.email, "axilleas0@yahoo.gr")
        self.assertEqual(user.password_hash, pw_hash)
        session.add.assert_called_once()
        session.flush.assert_awaited()


if __name__ == "__main__":
    unittest.main()
