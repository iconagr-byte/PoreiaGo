"""Immutable audit trail + GDPR-safe redaction helpers."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditAction, AuditLog

ANON_EMAIL_DOMAIN = "anon.erased.local"


class AuditImmutableError(Exception):
    pass


class AuditService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def record(
        self,
        *,
        tenant_id: UUID,
        actor_id: UUID | None,
        actor_email: str | None,
        action: AuditAction,
        resource_type: str,
        resource_id: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
        before_state: dict[str, Any] | None = None,
        after_state: dict[str, Any] | None = None,
        detail: str | None = None,
    ) -> AuditLog:
        entry = AuditLog(
            tenant_id=tenant_id,
            actor_id=actor_id,
            actor_email=actor_email,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            user_agent=user_agent,
            before_state=before_state,
            after_state=after_state,
            detail=detail,
        )
        self._session.add(entry)
        await self._session.flush()
        return entry

    async def list_logs(
        self,
        tenant_id: UUID,
        *,
        resource_type: str | None = None,
        resource_id: str | None = None,
        actor_id: UUID | None = None,
        action: AuditAction | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[AuditLog], int]:
        limit = min(max(limit, 1), 500)
        stmt = select(AuditLog).where(AuditLog.tenant_id == tenant_id)
        count_stmt = select(func.count()).select_from(AuditLog).where(AuditLog.tenant_id == tenant_id)

        if resource_type:
            stmt = stmt.where(AuditLog.resource_type == resource_type)
            count_stmt = count_stmt.where(AuditLog.resource_type == resource_type)
        if resource_id:
            stmt = stmt.where(AuditLog.resource_id == resource_id)
            count_stmt = count_stmt.where(AuditLog.resource_id == resource_id)
        if actor_id:
            stmt = stmt.where(AuditLog.actor_id == actor_id)
            count_stmt = count_stmt.where(AuditLog.actor_id == actor_id)
        if action:
            stmt = stmt.where(AuditLog.action == action)
            count_stmt = count_stmt.where(AuditLog.action == action)

        total = int(await self._session.scalar(count_stmt) or 0)
        result = await self._session.execute(
            stmt.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit),
        )
        return list(result.scalars().all()), total

    async def logs_for_subject_email(
        self,
        tenant_id: UUID,
        email: str,
        *,
        limit: int = 200,
    ) -> list[AuditLog]:
        normalized = email.strip().lower()
        result = await self._session.execute(
            select(AuditLog)
            .where(
                AuditLog.tenant_id == tenant_id,
                func.lower(AuditLog.actor_email) == normalized,
            )
            .order_by(AuditLog.created_at.desc())
            .limit(limit),
        )
        return list(result.scalars().all())

    async def redact_subject_references(
        self,
        tenant_id: UUID,
        subject_email: str,
    ) -> int:
        """GDPR erasure — scrub PII from historical audit rows referencing the subject."""
        normalized = subject_email.strip().lower()
        result = await self._session.execute(
            select(AuditLog).where(
                AuditLog.tenant_id == tenant_id,
                func.lower(AuditLog.actor_email) == normalized,
            ),
        )
        count = 0
        for entry in result.scalars().all():
            entry.actor_email = f"redacted@{ANON_EMAIL_DOMAIN}"
            entry.before_state = _scrub_state(entry.before_state)
            entry.after_state = _scrub_state(entry.after_state)
            count += 1
        return count

    async def update_entry(self, *_args, **_kwargs) -> None:
        raise AuditImmutableError("Audit logs cannot be modified")

    async def delete_entry(self, *_args, **_kwargs) -> None:
        raise AuditImmutableError("Audit logs cannot be deleted")


def _scrub_state(state: dict[str, Any] | None) -> dict[str, Any] | None:
    if not state:
        return state
    scrubbed = dict(state)
    for key in ("email", "passenger_email", "phone", "passenger_name", "name", "full_name"):
        if key in scrubbed:
            scrubbed[key] = "[redacted]"
    return scrubbed


def audit_log_to_dict(entry: AuditLog) -> dict[str, Any]:
    return {
        "id": str(entry.id),
        "tenant_id": str(entry.tenant_id),
        "actor_id": str(entry.actor_id) if entry.actor_id else None,
        "actor_email": entry.actor_email,
        "action": entry.action.value,
        "resource_type": entry.resource_type,
        "resource_id": entry.resource_id,
        "ip_address": str(entry.ip_address) if entry.ip_address else None,
        "user_agent": entry.user_agent,
        "before_state": entry.before_state,
        "after_state": entry.after_state,
        "detail": entry.detail,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
    }
