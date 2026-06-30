"""Create and verify tenant API keys (telemetry devices, partners)."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_key import ApiKeyScope, TenantApiKey


def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def generate_api_key() -> tuple[str, str, str]:
    """Returns (raw_key, prefix, hash)."""
    suffix = secrets.token_urlsafe(24)
    raw = f"tsk_{suffix}"
    prefix = raw[:12]
    return raw, prefix, hash_api_key(raw)


class ApiKeyService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_key(
        self,
        *,
        tenant_id: UUID,
        name: str,
        scope: ApiKeyScope = ApiKeyScope.TELEMETRY,
    ) -> tuple[TenantApiKey, str]:
        raw, prefix, key_hash = generate_api_key()
        row = TenantApiKey(
            tenant_id=tenant_id,
            name=name,
            key_prefix=prefix,
            key_hash=key_hash,
            scope=scope,
        )
        self._session.add(row)
        await self._session.flush()
        return row, raw

    async def resolve_tenant_id(
        self,
        raw_key: str,
        *,
        scope: ApiKeyScope | None = ApiKeyScope.TELEMETRY,
    ) -> UUID | None:
        if not raw_key or len(raw_key) < 16:
            return None
        key_hash = hash_api_key(raw_key.strip())
        stmt = select(TenantApiKey).where(
            TenantApiKey.key_hash == key_hash,
            TenantApiKey.is_active.is_(True),
        )
        if scope:
            stmt = stmt.where(TenantApiKey.scope == scope)
        result = await self._session.execute(stmt)
        row = result.scalar_one_or_none()
        if not row:
            return None
        await self._session.execute(
            update(TenantApiKey)
            .where(TenantApiKey.id == row.id)
            .values(last_used_at=datetime.now(timezone.utc)),
        )
        return row.tenant_id
