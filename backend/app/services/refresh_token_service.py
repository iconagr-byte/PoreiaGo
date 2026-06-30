"""Opaque refresh token issuance and rotation."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.refresh_token import RefreshToken
from app.models.tenant import Tenant
from app.models.user import User, UserRole


def hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


class RefreshTokenService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._settings = get_settings()

    async def issue(self, *, user_id: UUID, tenant_id: UUID) -> str:
        raw = secrets.token_urlsafe(48)
        row = RefreshToken(
            user_id=user_id,
            tenant_id=tenant_id,
            token_hash=hash_refresh_token(raw),
            expires_at=datetime.now(timezone.utc)
            + timedelta(days=self._settings.refresh_token_expire_days),
        )
        self._session.add(row)
        await self._session.flush()
        return raw

    async def rotate(
        self,
        raw_token: str,
    ) -> tuple[str, User, Tenant]:
        """Validate refresh token, revoke it, issue a new one. Returns (new_raw, user, tenant)."""
        token_hash = hash_refresh_token(raw_token.strip())
        now = datetime.now(timezone.utc)

        result = await self._session.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash).limit(1),
        )
        stored = result.scalar_one_or_none()
        if not stored or stored.revoked_at is not None:
            raise ValueError("Invalid refresh token")
        if stored.expires_at <= now:
            raise ValueError("Refresh token expired")

        user_result = await self._session.execute(select(User).where(User.id == stored.user_id))
        user = user_result.scalar_one_or_none()
        if not user or not user.is_active:
            raise ValueError("Invalid refresh token")

        tenant_result = await self._session.execute(select(Tenant).where(Tenant.id == stored.tenant_id))
        tenant = tenant_result.scalar_one_or_none()
        if not tenant or not tenant.is_active:
            raise ValueError("Tenant inactive")

        new_raw = await self.issue(user_id=user.id, tenant_id=tenant.id)
        new_result = await self._session.execute(
            select(RefreshToken)
            .where(RefreshToken.token_hash == hash_refresh_token(new_raw))
            .limit(1),
        )
        new_row = new_result.scalar_one()

        stored.revoked_at = now
        stored.replaced_by_id = new_row.id
        await self._session.flush()
        return new_raw, user, tenant

    async def revoke_for_user(self, user_id: UUID) -> int:
        now = datetime.now(timezone.utc)
        result = await self._session.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
            ),
        )
        count = 0
        for row in result.scalars().all():
            row.revoked_at = now
            count += 1
        return count

    @staticmethod
    def user_roles(user: User) -> list[UserRole]:
        return [UserRole(r) for r in (user.roles or []) if r in {e.value for e in UserRole}]
