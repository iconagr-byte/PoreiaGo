"""SuperAdmin masquerade — temporary tenant session with mandatory audit."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.audit import AuditAction
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from app.services.audit_service import AuditService
from olympus.config import get_olympus_settings


class ImpersonationService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._audit = AuditService(session)
        self._olympus = get_olympus_settings()

    async def start_impersonation(
        self,
        *,
        superadmin_id: UUID,
        superadmin_email: str,
        target_tenant_id: UUID,
        client_ip: str | None,
    ) -> str:
        tenant_result = await self._session.execute(
            select(Tenant).where(Tenant.id == target_tenant_id).limit(1),
        )
        tenant = tenant_result.scalar_one_or_none()
        if not tenant:
            raise ValueError("Tenant not found")

        ttl = self._olympus["impersonation_ttl_minutes"]
        token = create_access_token(
            user_id=superadmin_id,
            tenant_id=target_tenant_id,
            roles=[UserRole.TENANT_ADMIN],
            mfa_verified=True,
            expires_minutes=ttl,
            extra={
                "email": superadmin_email,
                "tenant_slug": tenant.slug,
                "impersonating": True,
                "original_sub": str(superadmin_id),
                "impersonation_target": str(target_tenant_id),
            },
        )

        await self._audit.record(
            tenant_id=target_tenant_id,
            actor_id=superadmin_id,
            actor_email=superadmin_email,
            action=AuditAction.IMPERSONATION_START,
            resource_type="tenant",
            resource_id=str(target_tenant_id),
            ip_address=client_ip,
            detail=f"SuperAdmin impersonation started (TTL {ttl}m)",
        )
        return token

    async def resolve_superadmin_email(self, superadmin_id: UUID) -> str:
        result = await self._session.execute(select(User).where(User.id == superadmin_id).limit(1))
        user = result.scalar_one_or_none()
        return user.email if user else str(superadmin_id)
