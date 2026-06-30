"""Aggregate metered usage: active buses + monthly trips."""

from __future__ import annotations

import logging
from calendar import monthrange
from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.subscription import UsageSnapshot

logger = logging.getLogger(__name__)


def _month_bounds(reference: date | None = None) -> tuple[date, date]:
    ref = reference or date.today()
    start = ref.replace(day=1)
    last_day = monthrange(ref.year, ref.month)[1]
    end = ref.replace(day=last_day)
    return start, end


async def count_active_buses(session: AsyncSession, tenant_id: UUID) -> int:
    """Active fleet units — distinct vehicles on active drivers, else file-backed fleet."""
    try:
        result = await session.execute(
            text(
                """
                SELECT COUNT(DISTINCT COALESCE(vehicle_code, license_plate))::int
                FROM drivers
                WHERE tenant_id = :tid
                  AND status = 'active'
                  AND COALESCE(vehicle_code, license_plate) IS NOT NULL
                """
            ),
            {"tid": str(tenant_id)},
        )
        count = int(result.scalar() or 0)
        if count > 0:
            return count
    except Exception as exc:
        logger.debug("Driver-based bus count unavailable for %s: %s", tenant_id, exc)

    try:
        from travel_platform.fleet.service_service import service_service

        return len(service_service.list_vehicles())
    except Exception as exc:
        logger.debug("Fleet vehicle count unavailable: %s", exc)
        return 0


async def count_monthly_trips(session: AsyncSession, tenant_id: UUID) -> int:
    """Completed/synced trips in Postgres `trips` table for tenant."""
    try:
        result = await session.execute(
            text(
                """
                SELECT COUNT(*)::int
                FROM trips
                WHERE tenant_id = :tid
                  AND created_at >= date_trunc('month', CURRENT_DATE)
                """
            ),
            {"tid": str(tenant_id)},
        )
        row = result.scalar()
        return int(row or 0)
    except Exception:
        return 0


class UsageMeteringService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def snapshot_current_month(self, tenant_id: UUID) -> UsageSnapshot:
        period_start, period_end = _month_bounds()
        active_buses = await count_active_buses(self._session, tenant_id)
        monthly_trips = await count_monthly_trips(self._session, tenant_id)

        existing = await self._session.execute(
            select(UsageSnapshot).where(
                UsageSnapshot.tenant_id == tenant_id,
                UsageSnapshot.period_start == period_start,
            ),
        )
        snap = existing.scalar_one_or_none()
        if snap:
            snap.active_buses = active_buses
            snap.monthly_trips = monthly_trips
            snap.period_end = period_end
            return snap

        snap = UsageSnapshot(
            tenant_id=tenant_id,
            period_start=period_start,
            period_end=period_end,
            active_buses=active_buses,
            monthly_trips=monthly_trips,
            created_at=datetime.now(timezone.utc),
        )
        self._session.add(snap)
        await self._session.flush()
        return snap

    async def mrr_estimate_cents(self) -> int:
        """Rough MRR from active/trialing subscriptions base_amount_cents."""
        from app.models.subscription import Subscription, SubscriptionStatus

        result = await self._session.execute(
            select(func.coalesce(func.sum(Subscription.base_amount_cents), 0)).where(
                Subscription.status.in_(
                    [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
                ),
            ),
        )
        return int(result.scalar() or 0)

    async def snapshot_all_tenants(self) -> dict:
        """Upsert usage snapshots for every tenant (no Stripe push)."""
        from app.models.tenant import Tenant

        result = await self._session.execute(select(Tenant.id))
        tenant_ids = list(result.scalars().all())
        stats = {"tenants": len(tenant_ids), "snapshots": 0}
        for tenant_id in tenant_ids:
            await self.snapshot_current_month(tenant_id)
            stats["snapshots"] += 1
        return stats

    async def snapshot_all_tenants(self) -> dict:
        """Upsert usage snapshots for every tenant (no Stripe push)."""
        from app.models.tenant import Tenant

        result = await self._session.execute(select(Tenant.id))
        tenant_ids = list(result.scalars().all())
        stats = {"tenants": len(tenant_ids), "snapshots": 0}
        for tenant_id in tenant_ids:
            await self.snapshot_current_month(tenant_id)
            stats["snapshots"] += 1
        return stats
