"""Office host login must not inherit PoreiaGo platform superadmin via same email."""

from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.models.user import UserRole
from app.services.auth_service import AuthService, hash_password, roles_safe_for_office


class RolesSafeForOfficeTests(unittest.TestCase):
    def test_strips_superadmin_on_office(self):
        roles = roles_safe_for_office(
            [UserRole.SUPERADMIN.value, UserRole.TENANT_ADMIN.value],
            allow_superadmin=False,
        )
        self.assertEqual(roles, [UserRole.TENANT_ADMIN.value])

    def test_keeps_superadmin_on_platform(self):
        roles = roles_safe_for_office(
            [UserRole.SUPERADMIN.value, UserRole.TENANT_ADMIN.value],
            allow_superadmin=True,
        )
        self.assertEqual(
            roles,
            [UserRole.SUPERADMIN.value, UserRole.TENANT_ADMIN.value],
        )

    def test_fallback_tenant_admin_when_only_superadmin_stripped(self):
        roles = roles_safe_for_office(
            [UserRole.SUPERADMIN.value],
            allow_superadmin=False,
        )
        self.assertEqual(roles, [UserRole.TENANT_ADMIN.value])


class MirrorStripsSuperadminOntoOfficeTests(unittest.IsolatedAsyncioTestCase):
    async def test_mirror_platform_superadmin_onto_iconarent_strips_role(self):
        platform_tid = uuid4()
        iconarent_tid = uuid4()
        password = "Admin@1234"
        pw_hash = hash_password(password)

        source = SimpleNamespace(
            id=uuid4(),
            tenant_id=platform_tid,
            email="axilleas0@yahoo.gr",
            password_hash=pw_hash,
            full_name="Axilleas",
            roles=[UserRole.SUPERADMIN.value, UserRole.TENANT_ADMIN.value],
            is_active=True,
        )

        session = AsyncMock()
        match_result = MagicMock()
        match_result.scalars.return_value.all.return_value = [source]

        platform_tenant = SimpleNamespace(
            id=platform_tid,
            slug="achillio",
            subdomain="achillio",
            custom_domain=None,
            legal_name="PoreiaGo",
        )
        iconarent_tenant = SimpleNamespace(
            id=iconarent_tid,
            slug="iconarent",
            subdomain="iconarent",
            custom_domain=None,
            legal_name="IconaRent",
        )

        platform_lookup = MagicMock()
        platform_lookup.scalar_one_or_none.return_value = platform_tenant
        iconarent_lookup = MagicMock()
        iconarent_lookup.scalar_one_or_none.return_value = iconarent_tenant

        existing_result = MagicMock()
        existing_result.scalar_one_or_none.return_value = None

        session.execute = AsyncMock(
            side_effect=[
                MagicMock(),  # SET LOCAL row_security (_match)
                match_result,
                platform_lookup,  # source classifier
                MagicMock(),  # SET LOCAL again
                iconarent_lookup,  # target roles_safe
                existing_result,
            ],
        )
        session.add = MagicMock()
        session.flush = AsyncMock()

        with (
            patch(
                "app.services.tenant_modules.is_achillio_travel_office",
                return_value=False,
            ),
            patch(
                "app.services.tenant_modules.is_poreiago_platform_office",
                side_effect=lambda t: getattr(t, "slug", "") == "achillio",
            ),
        ):
            service = AuthService(session)
            user = await service._mirror_user_onto_tenant(
                target_tenant_id=iconarent_tid,
                email="axilleas0@yahoo.gr",
                password=password,
            )

        self.assertIsNotNone(user)
        self.assertEqual(user.tenant_id, iconarent_tid)
        self.assertNotIn(UserRole.SUPERADMIN.value, user.roles)
        self.assertIn(UserRole.TENANT_ADMIN.value, user.roles)
        session.add.assert_called_once()


class HealExistingOfficeSuperadminTests(unittest.IsolatedAsyncioTestCase):
    async def test_apply_office_safe_roles_heals_iconarent_user(self):
        iconarent_tid = uuid4()
        iconarent_tenant = SimpleNamespace(
            id=iconarent_tid,
            slug="iconarent",
            subdomain="iconarent",
            custom_domain=None,
            legal_name="IconaRent",
        )
        user = SimpleNamespace(
            id=uuid4(),
            tenant_id=iconarent_tid,
            email="axilleas0@yahoo.gr",
            roles=[UserRole.SUPERADMIN.value, UserRole.TENANT_ADMIN.value],
        )
        session = AsyncMock()
        session.flush = AsyncMock()
        service = AuthService(session)

        with (
            patch(
                "app.services.tenant_modules.is_achillio_travel_office",
                return_value=False,
            ),
            patch(
                "app.services.tenant_modules.is_poreiago_platform_office",
                return_value=False,
            ),
        ):
            healed = await service._apply_office_safe_roles(user, iconarent_tenant)

        self.assertEqual(healed.roles, [UserRole.TENANT_ADMIN.value])
        session.flush.assert_awaited()


if __name__ == "__main__":
    unittest.main()
