"""GPS coordinate retention — purge trip_coordinates older than policy."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from travel_platform.telemetry.settings_store import get_telemetry_settings

logger = logging.getLogger(__name__)


async def purge_tenant_gps(
    session: AsyncSession,
    *,
    tenant_id: str | UUID,
    retention_days: int | None = None,
) -> int:
    """Delete GPS points older than retention window. Returns rows deleted."""
    tid = str(tenant_id)
    days = retention_days
    if days is None:
        days = get_telemetry_settings(tid).gps_retention_days
    if days <= 0:
        return 0

    cutoff = datetime.now(timezone.utc) - timedelta(days=int(days))
    result = await session.execute(
        text(
            """
            DELETE FROM trip_coordinates
            WHERE tenant_id = CAST(:tenant_id AS uuid)
              AND recorded_at < :cutoff
            """,
        ),
        {"tenant_id": tid, "cutoff": cutoff},
    )
    deleted = int(result.rowcount or 0)
    if deleted:
        logger.info(
            "GPS retention purge tenant=%s deleted=%s older_than_days=%s",
            tid,
            deleted,
            days,
        )
    return deleted


async def list_tenants_with_coordinates(session: AsyncSession) -> list[str]:
    result = await session.execute(
        text("SELECT DISTINCT tenant_id::text FROM trip_coordinates"),
    )
    return [str(row[0]) for row in result.fetchall()]


async def purge_expired_gps_all() -> dict[str, int]:
    """Purge expired GPS for every tenant that has trip_coordinates rows."""
    try:
        from app.core.database import AsyncSessionLocal
    except ImportError:
        from database import AsyncSessionLocal

    totals: dict[str, int] = {}
    async with AsyncSessionLocal() as session:
        tenant_ids = await list_tenants_with_coordinates(session)
        for tid in tenant_ids:
            deleted = await purge_tenant_gps(session, tenant_id=tid)
            if deleted:
                totals[tid] = deleted
        if totals:
            await session.commit()
        else:
            await session.rollback()
    return totals
