"""SuperAdmin masquerade — temporary tenant session with mandatory audit."""

from __future__ import annotations

import ipaddress
import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.audit import AuditAction
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from app.services.audit_service import AuditService
from olympus.config import get_olympus_settings

logger = logging.getLogger(__name__)


def _safe_inet(ip: str | None) -> str | None:
    """Postgres INET rejects garbage from X-Forwarded-For."""
    if not ip:
        return None
    raw = str(ip).strip().split("%", 1)[0].strip()
    if not raw:
        return None
    try:
        return str(ipaddress.ip_address(raw))
    except ValueError:
        return None


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
    ) -> tuple[str, str]:
        """Return ``(access_token, tenant_slug)``.

        Audit write is best-effort: a schema/CHECK/INET failure must never
        block SuperAdmin from opening an office.

        Snapshot scalar columns before any rollback/commit — after
        ``ensure_audit_logs_schema`` commits, expired ORM instances raise
        ``MissingGreenlet`` on attribute access in async SQLAlchemy.
        """
        row = (
            await self._session.execute(
                select(Tenant.slug).where(Tenant.id == target_tenant_id).limit(1),
            )
        ).first()
        if not row:
            raise ValueError("Tenant not found")
        tenant_slug = str(row[0] or "").strip()

        ttl = self._olympus["impersonation_ttl_minutes"]
        token = create_access_token(
            user_id=superadmin_id,
            tenant_id=target_tenant_id,
            roles=[UserRole.TENANT_ADMIN],
            mfa_verified=True,
            expires_minutes=ttl,
            extra={
                "email": superadmin_email,
                "tenant_slug": tenant_slug,
                "impersonating": True,
                "original_sub": str(superadmin_id),
                "impersonation_target": str(target_tenant_id),
            },
        )

        await self._record_audit_best_effort(
            tenant_id=target_tenant_id,
            actor_id=superadmin_id,
            actor_email=superadmin_email,
            client_ip=client_ip,
            detail=f"SuperAdmin impersonation started (TTL {ttl}m)",
        )
        return token, tenant_slug

    async def _record_audit_best_effort(
        self,
        *,
        tenant_id: UUID,
        actor_id: UUID,
        actor_email: str,
        client_ip: str | None,
        detail: str,
    ) -> None:
        safe_ip = _safe_inet(client_ip)
        for attempt in (1, 2):
            try:
                await self._audit.record(
                    tenant_id=tenant_id,
                    actor_id=actor_id,
                    actor_email=actor_email,
                    action=AuditAction.IMPERSONATION_START,
                    resource_type="tenant",
                    resource_id=str(tenant_id),
                    ip_address=safe_ip,
                    detail=detail,
                )
                return
            except Exception as exc:
                logger.warning(
                    "Impersonation audit write failed (attempt %s): %s",
                    attempt,
                    exc,
                )
                try:
                    await self._session.rollback()
                except Exception:
                    pass
                if attempt == 1:
                    # Heal on a *separate* session so DDL commit does not
                    # expire ORM state on the request session mid-flight.
                    try:
                        from app.services.ensure_audit_logs_schema import (
                            ensure_audit_logs_schema_best_effort,
                        )

                        await ensure_audit_logs_schema_best_effort()
                    except Exception:
                        logger.exception("Audit schema heal during impersonation failed")
                # attempt 2 exhausted → continue without audit

    async def resolve_superadmin_email(self, superadmin_id: UUID) -> str:
        row = (
            await self._session.execute(
                select(User.email).where(User.id == superadmin_id).limit(1),
            )
        ).first()
        if not row or not row[0]:
            return str(superadmin_id)
        return str(row[0])
