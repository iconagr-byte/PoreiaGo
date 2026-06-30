"""Base class for tenant-scoped application services."""

from __future__ import annotations

from abc import ABC
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import TenantIsolationError
from middleware.tenant import apply_tenant_to_session
from travel_platform.compliance.audit_trail import AuditContext, AuditTrailService


class TenantScopedService(ABC):
    """
    All platform services inherit this to enforce tenant context on DB work
    and optional audit emission.
    """

    def __init__(
        self,
        session: AsyncSession,
        tenant_id: UUID,
        *,
        audit: AuditTrailService | None = None,
        actor_id: str | None = None,
    ):
        if tenant_id is None:
            raise TenantIsolationError("tenant_id is required for all platform operations")
        self._session = session
        self._tenant_id = tenant_id
        self._audit = audit or AuditTrailService(session)
        self._actor_id = actor_id

    @property
    def tenant_id(self) -> UUID:
        return self._tenant_id

    @property
    def session(self) -> AsyncSession:
        return self._session

    async def _bind_tenant_rls(self) -> None:
        """Set PostgreSQL session variable for RLS policies."""
        await apply_tenant_to_session(self._session, self._tenant_id)

    def _tenant_filter(self, model: Any, extra: dict | None = None) -> dict:
        """Repository-level defense in depth (always combine with RLS)."""
        filt = {"tenant_id": self._tenant_id}
        if extra:
            filt.update(extra)
        return filt

    async def _audit(
        self,
        action: str,
        resource_type: str,
        resource_id: str,
        *,
        metadata: dict | None = None,
        financial: bool = False,
    ) -> None:
        ctx = AuditContext(
            tenant_id=self._tenant_id,
            actor_id=self._actor_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            metadata=metadata or {},
            financial=financial,
        )
        await self._audit.append(ctx)
