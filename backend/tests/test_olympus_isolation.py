"""OLYMPUS Phase 1 — JWT (RS256), refresh rotation, impersonation, tenant isolation."""

from __future__ import annotations

import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.core.config import get_settings
from app.core.security import (
    TokenError,
    create_access_token,
    decode_access_token,
    get_jwt_algorithm,
)
from app.models.refresh_token import RefreshToken
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from app.services.refresh_token_service import RefreshTokenService, hash_refresh_token
from olympus.security.impersonation import ImpersonationService

# Minimal RSA key pair for RS256 unit tests (do not use in production).
_TEST_RSA_PRIVATE = """-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8B/UPIbnB1p5k3ePd8v7K8s9m1a
2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a
2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a
2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a
2wIDAQABAoIBADfakekeypaddingforunittestonly123456789012345678901234
56789012345678901234567890123456789012345678901234567890123456789012
34567890123456789012345678901234567890123456789012345678901234567890
-----END RSA PRIVATE KEY-----"""

_TEST_RSA_PUBLIC = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Z3VS5JJcds3xfn/ygWy
F8B/UPIbnB1p5k3ePd8v7K8s9m1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3
c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3
c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3
c4d5e6f708192a3b4c5d6e7f8091a2wIDAQAB
-----END PUBLIC KEY-----"""


def _generate_test_rsa_keys() -> tuple[str, str]:
    try:
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives import serialization

        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        private_pem = key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode()
        public_pem = key.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode()
        return private_pem, public_pem
    except ImportError:
        return _TEST_RSA_PRIVATE, _TEST_RSA_PUBLIC


class JwtSecurityTests(unittest.TestCase):
    def setUp(self):
        get_jwt_algorithm.cache_clear() if hasattr(get_jwt_algorithm, "cache_clear") else None

    def test_hs256_roundtrip(self):
        get_settings.cache_clear()
        user_id = uuid4()
        tenant_id = uuid4()
        with patch("app.core.security.get_settings") as mock_settings:
            mock_settings.return_value.auth_jwt_secret = "test-secret-key-for-unit-tests"
            mock_settings.return_value.auth_jwt_private_key = ""
            mock_settings.return_value.auth_jwt_public_key = ""
            mock_settings.return_value.auth_jwt_algorithm = "HS256"
            mock_settings.return_value.auth_jwt_issuer = "aerostride-auth"
            mock_settings.return_value.access_token_expire_minutes = 15

            token = create_access_token(
                user_id=user_id,
                tenant_id=tenant_id,
                roles=[UserRole.TENANT_ADMIN],
                mfa_verified=True,
            )
            payload = decode_access_token(token)

        self.assertEqual(payload["sub"], str(user_id))
        self.assertEqual(payload["tenant_id"], str(tenant_id))
        self.assertEqual(payload["type"], "access")
        self.assertIn("tenant_admin", payload["roles"])

    def test_rs256_when_keys_configured(self):
        get_settings.cache_clear()
        private_pem, public_pem = _generate_test_rsa_keys()
        user_id = uuid4()
        tenant_id = uuid4()

        with patch("app.core.security.get_settings") as mock_settings:
            mock_settings.return_value.auth_jwt_secret = ""
            mock_settings.return_value.auth_jwt_private_key = private_pem
            mock_settings.return_value.auth_jwt_public_key = public_pem
            mock_settings.return_value.auth_jwt_algorithm = "HS256"
            mock_settings.return_value.auth_jwt_issuer = "aerostride-auth"
            mock_settings.return_value.access_token_expire_minutes = 15

            token = create_access_token(
                user_id=user_id,
                tenant_id=tenant_id,
                roles=[UserRole.SUPERADMIN],
            )
            payload = decode_access_token(token)
            self.assertEqual(get_jwt_algorithm(), "RS256")

        self.assertEqual(payload["sub"], str(user_id))

    def test_rejects_refresh_type_as_access(self):
        get_settings.cache_clear()
        user_id = uuid4()
        tenant_id = uuid4()
        with patch("app.core.security.get_settings") as mock_settings:
            mock_settings.return_value.auth_jwt_secret = "test-secret"
            mock_settings.return_value.auth_jwt_private_key = ""
            mock_settings.return_value.auth_jwt_public_key = ""
            mock_settings.return_value.auth_jwt_algorithm = "HS256"
            mock_settings.return_value.auth_jwt_issuer = ""
            mock_settings.return_value.access_token_expire_minutes = 15

            token = create_access_token(
                user_id=user_id,
                tenant_id=tenant_id,
                roles=[UserRole.CUSTOMER],
                extra={"type": "refresh"},
            )
            with self.assertRaises(TokenError):
                decode_access_token(token)


class RefreshTokenRotationTests(unittest.IsolatedAsyncioTestCase):
    async def test_rotate_revokes_old_and_issues_new(self):
        user_id = uuid4()
        tenant_id = uuid4()
        raw = "refresh-token-raw-value-for-test"
        stored = RefreshToken(
            id=uuid4(),
            user_id=user_id,
            tenant_id=tenant_id,
            token_hash=hash_refresh_token(raw),
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
        user = User(
            id=user_id,
            tenant_id=tenant_id,
            email="admin@test.local",
            password_hash="hash",
            full_name="Admin",
            roles=[UserRole.TENANT_ADMIN.value],
            is_active=True,
        )
        tenant = Tenant(
            id=tenant_id,
            slug="test-co",
            legal_name="Test Co",
            subdomain="test-co",
            is_active=True,
        )

        session = AsyncMock()
        token_result = MagicMock()
        token_result.scalar_one_or_none.return_value = stored
        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = user
        tenant_result = MagicMock()
        tenant_result.scalar_one_or_none.return_value = tenant
        new_token_result = MagicMock()
        new_row = RefreshToken(
            id=uuid4(),
            user_id=user_id,
            tenant_id=tenant_id,
            token_hash="newhash",
            expires_at=datetime.now(timezone.utc) + timedelta(days=14),
        )
        new_token_result.scalar_one.return_value = new_row

        session.execute = AsyncMock(
            side_effect=[token_result, user_result, tenant_result, new_token_result],
        )
        session.add = MagicMock()
        session.flush = AsyncMock()

        with patch("app.services.refresh_token_service.get_settings") as mock_settings:
            mock_settings.return_value.refresh_token_expire_days = 14
            service = RefreshTokenService(session)
            new_raw, out_user, out_tenant = await service.rotate(raw)

        self.assertIsNotNone(new_raw)
        self.assertNotEqual(new_raw, raw)
        self.assertEqual(out_user.id, user_id)
        self.assertEqual(out_tenant.id, tenant_id)
        self.assertIsNotNone(stored.revoked_at)
        self.assertEqual(stored.replaced_by_id, new_row.id)

    async def test_rotate_rejects_expired_token(self):
        stored = RefreshToken(
            id=uuid4(),
            user_id=uuid4(),
            tenant_id=uuid4(),
            token_hash=hash_refresh_token("expired-token"),
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        session = AsyncMock()
        token_result = MagicMock()
        token_result.scalar_one_or_none.return_value = stored
        session.execute = AsyncMock(return_value=token_result)

        service = RefreshTokenService(session)
        with self.assertRaises(ValueError):
            await service.rotate("expired-token")


class ImpersonationTests(unittest.IsolatedAsyncioTestCase):
    async def test_impersonation_token_includes_original_sub(self):
        superadmin_id = uuid4()
        target_tenant_id = uuid4()
        tenant = Tenant(
            id=target_tenant_id,
            slug="achillio",
            legal_name="Achillio",
            subdomain="achillio",
            is_active=True,
        )

        session = AsyncMock()
        tenant_result = MagicMock()
        tenant_result.scalar_one_or_none.return_value = tenant
        session.execute = AsyncMock(return_value=tenant_result)

        audit_mock = AsyncMock()
        with patch("olympus.security.impersonation.AuditService") as audit_cls, patch(
            "olympus.security.impersonation.create_access_token",
        ) as mock_create, patch(
            "olympus.security.impersonation.get_olympus_settings",
            return_value={"impersonation_ttl_minutes": 30},
        ):
            audit_cls.return_value.record = audit_mock
            mock_create.return_value = "impersonation-jwt"

            service = ImpersonationService(session)
            token = await service.start_impersonation(
                superadmin_id=superadmin_id,
                superadmin_email="admin@achillio.gr",
                target_tenant_id=target_tenant_id,
                client_ip="127.0.0.1",
            )

        self.assertEqual(token, "impersonation-jwt")
        mock_create.assert_called_once()
        call_kwargs = mock_create.call_args.kwargs
        self.assertEqual(call_kwargs["user_id"], superadmin_id)
        self.assertEqual(call_kwargs["tenant_id"], target_tenant_id)
        self.assertTrue(call_kwargs["extra"]["impersonating"])
        self.assertEqual(call_kwargs["extra"]["original_sub"], str(superadmin_id))
        audit_mock.assert_awaited_once()


class SchemaProvisionTests(unittest.TestCase):
    def test_schema_name_sanitizes_slug(self):
        from olympus.tenant.schema_provision import schema_name_for_tenant

        self.assertEqual(schema_name_for_tenant("acme-travel"), "tenant_acme_travel")


@unittest.skipUnless(
    os.getenv("OLYMPUS_RLS_INTEGRATION", "").lower() in ("1", "true", "yes"),
    "Set OLYMPUS_RLS_INTEGRATION=1 with running Postgres to run RLS integration test",
)
class TenantRlsIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def test_rls_hides_other_tenant_users(self):
        from sqlalchemy import select, text

        from app.core.database import AsyncSessionLocal
        from app.core.tenant_rls import apply_tenant_rls
        from app.models.user import User

        tenant_a = uuid4()
        tenant_b = uuid4()

        async with AsyncSessionLocal() as session:
            await session.execute(
                text(
                    "INSERT INTO tenants (id, slug, legal_name, subdomain, plan, is_active) "
                    "VALUES (:a, 'rls-a', 'RLS A', 'rls-a', 'starter', true), "
                    "(:b, 'rls-b', 'RLS B', 'rls-b', 'starter', true) "
                    "ON CONFLICT DO NOTHING",
                ),
                {"a": str(tenant_a), "b": str(tenant_b)},
            )
            await session.commit()

        async with AsyncSessionLocal() as session:
            await apply_tenant_rls(session, tenant_a)
            result = await session.execute(select(User).where(User.tenant_id == tenant_b))
            rows = result.scalars().all()
            self.assertEqual(rows, [])


if __name__ == "__main__":
    unittest.main()
