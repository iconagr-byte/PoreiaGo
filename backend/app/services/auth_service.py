"""Authentication — password verify, login, MFA step-up."""

from __future__ import annotations

import hashlib
import secrets
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.tenant_rls import apply_tenant_rls
from app.core.security import create_access_token
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from app.services.mfa_service import MfaService
from app.services.refresh_token_service import RefreshTokenService


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000)
    return f"pbkdf2_sha256${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, salt, digest_hex = stored.split("$", 2)
        if algo != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000)
        return secrets.compare_digest(digest.hex(), digest_hex)
    except ValueError:
        return False


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._mfa = MfaService()
        self._settings = get_settings()

    async def authenticate(
        self,
        *,
        tenant_id: UUID,
        email: str,
        password: str,
        mfa_code: str | None = None,
    ) -> tuple[str, str, User]:
        tenant_result = await self._session.execute(
            select(Tenant).where(Tenant.id == tenant_id),
        )
        tenant = tenant_result.scalar_one_or_none()
        if not tenant:
            raise ValueError("Invalid credentials")

        result = await self._session.execute(
            select(User).where(User.tenant_id == tenant_id, User.email == email.lower()),
        )
        user = result.scalar_one_or_none()
        if not user or not user.is_active or not verify_password(password, user.password_hash):
            raise ValueError("Invalid credentials")

        user = await self._ensure_dev_superadmin(user)

        roles = [UserRole(r) for r in (user.roles or []) if r in {e.value for e in UserRole}]
        mfa_verified = True

        required = {r.strip() for r in self._settings.mfa_required_roles.split(",") if r.strip()}
        if user.mfa_enabled and roles and any(r.value in required for r in roles):
            if not user.mfa_secret_encrypted or not mfa_code:
                raise ValueError("MFA code required")
            secret = MfaService.decrypt_secret_from_storage(
                user.mfa_secret_encrypted,
                pepper=self._settings.auth_jwt_secret,
            )
            if not self._mfa.verify(secret, mfa_code):
                raise ValueError("Invalid MFA code")
            mfa_verified = True
        elif user.mfa_enabled and mfa_code and user.mfa_secret_encrypted:
            secret = MfaService.decrypt_secret_from_storage(
                user.mfa_secret_encrypted,
                pepper=self._settings.auth_jwt_secret,
            )
            mfa_verified = self._mfa.verify(secret, mfa_code)

        token = create_access_token(
            user_id=user.id,
            tenant_id=user.tenant_id,
            roles=roles or [UserRole.CUSTOMER],
            mfa_verified=mfa_verified,
            extra={"tenant_slug": tenant.slug},
        )
        refresh = await RefreshTokenService(self._session).issue(
            user_id=user.id,
            tenant_id=user.tenant_id,
        )
        return token, refresh, user

    async def login(
        self,
        *,
        email: str,
        password: str,
        tenant_id: UUID | None = None,
        tenant_slug: str | None = None,
        mfa_code: str | None = None,
    ) -> tuple[str, str, User, Tenant]:
        """Email + password login — tenant resolved automatically or via optional slug."""
        resolved_id = await self._resolve_tenant_id(
            email=email,
            password=password,
            tenant_id=tenant_id,
            tenant_slug=tenant_slug,
        )
        await apply_tenant_rls(self._session, resolved_id)
        token, refresh, user = await self.authenticate(
            tenant_id=resolved_id,
            email=email,
            password=password,
            mfa_code=mfa_code,
        )
        tenant_result = await self._session.execute(select(Tenant).where(Tenant.id == resolved_id))
        tenant = tenant_result.scalar_one()
        return token, refresh, user, tenant

    async def _resolve_tenant_id(
        self,
        *,
        email: str,
        password: str,
        tenant_id: UUID | None,
        tenant_slug: str | None,
    ) -> UUID:
        if tenant_id is not None:
            return tenant_id

        slug = (tenant_slug or "").strip().lower()
        if slug:
            result = await self._session.execute(select(Tenant).where(Tenant.slug == slug))
            tenant = result.scalar_one_or_none()
            if not tenant:
                raise ValueError("Άγνωστος κωδικός εταιρείας")
            return tenant.id

        matches = await self._match_users_by_email_password(email, password)
        if not matches:
            raise ValueError("Λάθος email ή κωδικός")
        if len(matches) > 1:
            raise ValueError(
                "Το email ανήκει σε πολλές εταιρείες — συμπληρώστε τον κωδικό εταιρείας (π.χ. achillio)",
            )
        return matches[0].tenant_id

    async def _match_users_by_email_password(self, email: str, password: str) -> list[User]:
        normalized = email.strip().lower()
        try:
            await self._session.execute(text("SET LOCAL row_security = off"))
        except Exception:
            pass
        result = await self._session.execute(
            select(User).where(func.lower(User.email) == normalized),
        )
        return [
            user
            for user in result.scalars().all()
            if user.is_active and verify_password(password, user.password_hash)
        ]

    async def _ensure_dev_superadmin(self, user: User) -> User:
        """Dev convenience — demo admin always gets superadmin without manual seed."""
        if self._settings.environment not in ("development", "dev", "local"):
            return user
        demo_emails = {"admin@achillio.gr", "admin@aerostride.com"}
        if user.email.lower() not in demo_emails:
            return user
        roles = list(user.roles or [])
        if UserRole.SUPERADMIN.value in roles:
            return user
        roles.append(UserRole.SUPERADMIN.value)
        user.roles = roles
        await self._session.flush()
        return user
