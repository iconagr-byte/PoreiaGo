"""FastAPI dependencies for /api/v1 platform routes."""

from __future__ import annotations

from typing import Annotated, AsyncGenerator
from uuid import UUID

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from middleware.tenant import apply_tenant_to_session
from travel_platform.compliance.audit_trail import AuditTrailService


async def get_tenant_id(request: Request) -> UUID:
    tid = getattr(request.state, "tenant_id", None)
    if tid is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail="Tenant context missing")
    return tid


async def get_actor_id(request: Request) -> str | None:
    return getattr(request.state, "user_id", None)


async def get_tenant_db(
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
) -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        await apply_tenant_to_session(session, tenant_id)
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def get_audit_service(
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
) -> AuditTrailService:
    return AuditTrailService(session)
