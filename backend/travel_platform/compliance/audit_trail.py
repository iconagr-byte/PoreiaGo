"""
Immutable audit trail — append-only events for financial, admin, and access actions.
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import AuditImmutableError

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AuditContext:
    tenant_id: UUID
    actor_id: str | None
    action: str
    resource_type: str
    resource_id: str
    metadata: dict[str, Any]
    financial: bool = False
    ip_address: str | None = None
    user_agent: str | None = None


class AuditTrailService:
    """
    Append-only writer. Never expose UPDATE/DELETE on audit_events.
    Optional hash chain: each row stores prev_hash + event_hash for tamper evidence.
    """

    def __init__(self, session: AsyncSession):
        self._session = session

    async def append(self, ctx: AuditContext) -> UUID:
        event_id = uuid4()
        prev_hash = await self._last_hash_for_tenant(ctx.tenant_id)
        payload = {
            "id": str(event_id),
            "tenant_id": str(ctx.tenant_id),
            "actor_id": ctx.actor_id,
            "action": ctx.action,
            "resource_type": ctx.resource_type,
            "resource_id": ctx.resource_id,
            "metadata": ctx.metadata,
            "financial": ctx.financial,
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "prev_hash": prev_hash,
        }
        event_hash = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()

        await self._session.execute(
            text("""
                INSERT INTO audit_events (
                    id, tenant_id, actor_id, action, resource_type, resource_id,
                    metadata, financial, ip_address, user_agent,
                    prev_hash, event_hash, created_at
                )
                VALUES (
                    :id, :tenant, :actor, :action, :rtype, :rid,
                    :meta::jsonb, :financial, :ip, :ua,
                    :prev, :ehash, NOW()
                )
            """),
            {
                "id": str(event_id),
                "tenant": str(ctx.tenant_id),
                "actor": ctx.actor_id,
                "action": ctx.action,
                "rtype": ctx.resource_type,
                "rid": ctx.resource_id,
                "meta": json.dumps(ctx.metadata),
                "financial": ctx.financial,
                "ip": ctx.ip_address,
                "ua": ctx.user_agent,
                "prev": prev_hash,
                "ehash": event_hash,
            },
        )
        logger.info(
            "audit tenant=%s action=%s resource=%s/%s",
            ctx.tenant_id,
            ctx.action,
            ctx.resource_type,
            ctx.resource_id,
        )
        return event_id

    async def query(
        self,
        tenant_id: UUID,
        *,
        resource_type: str | None = None,
        financial_only: bool = False,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        clauses = ["tenant_id = :tenant"]
        params: dict[str, Any] = {"tenant": str(tenant_id), "limit": limit}
        if resource_type:
            clauses.append("resource_type = :rtype")
            params["rtype"] = resource_type
        if financial_only:
            clauses.append("financial = true")
        where = " AND ".join(clauses)
        r = await self._session.execute(
            text(f"""
                SELECT id, actor_id, action, resource_type, resource_id,
                       metadata, financial, event_hash, created_at
                FROM audit_events
                WHERE {where}
                ORDER BY created_at DESC
                LIMIT :limit
            """),
            params,
        )
        return [dict(row) for row in r.mappings()]

    async def verify_chain(self, tenant_id: UUID, limit: int = 1000) -> bool:
        """Recompute hashes — detect tampering."""
        r = await self._session.execute(
            text("""
                SELECT id, tenant_id, actor_id, action, resource_type, resource_id,
                       metadata, financial, prev_hash, event_hash, created_at
                FROM audit_events
                WHERE tenant_id = :tenant
                ORDER BY created_at ASC
                LIMIT :limit
            """),
            {"tenant": str(tenant_id), "limit": limit},
        )
        prev = ""
        for row in r.mappings():
            if row["prev_hash"] != prev:
                return False
            prev = row["event_hash"]
        return True

    async def _last_hash_for_tenant(self, tenant_id: UUID) -> str:
        r = await self._session.execute(
            text("""
                SELECT event_hash FROM audit_events
                WHERE tenant_id = :tenant
                ORDER BY created_at DESC LIMIT 1
            """),
            {"tenant": str(tenant_id)},
        )
        val = r.scalar()
        return val or ""

    def forbid_mutation(self) -> None:
        """Call from migration policy — audit rows are immutable."""
        raise AuditImmutableError("Audit events cannot be modified or deleted")
