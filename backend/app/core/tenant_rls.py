"""Postgres RLS tenant context — kept separate from auth_deps to avoid import cycles."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession


async def apply_tenant_rls(session: AsyncSession, tenant_id: UUID) -> None:
    from sqlalchemy import text

    await session.execute(
        text("SELECT set_config('app.current_tenant', :tid, true)"),
        {"tid": str(tenant_id)},
    )
