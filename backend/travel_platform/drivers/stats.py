"""
Driver stats — reads from driver_stats_cache; recomputes via refresh_cache().
Links stop_feedback ratings to driver performance.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.base_service import TenantScopedService
from core.exceptions import PlatformError
from travel_platform.drivers.domain import DriverStatsSnapshot


class DriverStatsService(TenantScopedService):
    """GET /drivers/{id}/stats must use cache — never full table scan on hot path."""

    CACHE_MAX_AGE_HOURS = 6

    async def get_stats(self, driver_id: UUID, *, force_refresh: bool = False) -> DriverStatsSnapshot:
        await self._bind_tenant_rls()
        if force_refresh:
            await self.refresh_cache(driver_id)

        row = await self._load_cache(driver_id)
        if row:
            age_ok = self._cache_is_fresh(row["computed_at"])
            if age_ok:
                snap = self._cache_row_to_snapshot(driver_id, row, cache_hit=True)
                if snap.avg_passenger_rating is not None:
                    snap = DriverStatsSnapshot(
                        **{**snap.__dict__, "rating_percentile": await self._rating_percentile(driver_id, snap.avg_passenger_rating)}
                    )
                return snap

        await self.refresh_cache(driver_id)
        row = await self._load_cache(driver_id)
        if not row:
            raise PlatformError(f"Stats unavailable for driver {driver_id}")
        return self._cache_row_to_snapshot(driver_id, row, cache_hit=False)

    async def refresh_cache(self, driver_id: UUID) -> DriverStatsSnapshot:
        """Recompute from assignments + stop_feedback — call from Celery after trip complete."""
        await self._bind_tenant_rls()

        agg = await self._session.execute(
            text("""
                SELECT
                    COALESCE(SUM(distance_km) FILTER (WHERE status = 'completed'), 0) AS total_kms,
                    COALESCE(SUM(
                        EXTRACT(EPOCH FROM (shift_end - shift_start)) / 3600.0
                    ) FILTER (WHERE status = 'completed'), 0) AS total_hours,
                    COUNT(*) FILTER (WHERE status IN ('completed', 'scheduled', 'in_progress')) AS assignments_count,
                    COUNT(*) FILTER (WHERE status = 'completed') AS trips_completed
                FROM driver_assignments
                WHERE driver_id = :driver AND tenant_id = :tenant
            """),
            {"driver": str(driver_id), "tenant": str(self._tenant_id)},
        )
        metrics = agg.mappings().first()

        rating_row = await self._session.execute(
            text("""
                SELECT AVG(sf.rating)::float AS avg_rating, COUNT(sf.id)::int AS feedback_count
                FROM stop_feedback sf
                INNER JOIN bookings b ON b.id = sf.booking_id
                INNER JOIN driver_assignments da
                    ON da.trip_id = b.trip_id AND da.driver_id = :driver AND da.tenant_id = :tenant
                WHERE da.status = 'completed'
            """),
            {"driver": str(driver_id), "tenant": str(self._tenant_id)},
        )
        rating = rating_row.mappings().first()

        avg_rating = rating["avg_rating"] if rating else None
        feedback_count = rating["feedback_count"] or 0 if rating else 0
        percentile = await self._rating_percentile(driver_id, avg_rating) if avg_rating else None

        await self._session.execute(
            text("""
                INSERT INTO driver_stats_cache (
                    driver_id, tenant_id, total_kms_driven, total_hours_driven,
                    assignments_count, avg_passenger_rating, trips_completed, feedback_count, computed_at
                )
                VALUES (
                    :driver, :tenant, :kms, :hours, :assignments, :rating, :trips, :feedback, NOW()
                )
                ON CONFLICT (driver_id) DO UPDATE SET
                    total_kms_driven = EXCLUDED.total_kms_driven,
                    total_hours_driven = EXCLUDED.total_hours_driven,
                    assignments_count = EXCLUDED.assignments_count,
                    avg_passenger_rating = EXCLUDED.avg_passenger_rating,
                    trips_completed = EXCLUDED.trips_completed,
                    feedback_count = EXCLUDED.feedback_count,
                    computed_at = NOW()
            """),
            {
                "driver": str(driver_id),
                "tenant": str(self._tenant_id),
                "kms": metrics["total_kms"],
                "hours": metrics["total_hours"],
                "assignments": metrics["assignments_count"],
                "rating": avg_rating,
                "trips": metrics["trips_completed"],
                "feedback": feedback_count,
            },
        )
        await self._audit(
            "driver.stats_refreshed",
            "driver",
            str(driver_id),
            metadata={"avg_rating": avg_rating, "assignments": metrics["assignments_count"]},
        )

        row = await self._load_cache(driver_id)
        snap = self._cache_row_to_snapshot(driver_id, row, cache_hit=False)
        if snap.avg_passenger_rating is not None:
            pct = await self._rating_percentile(driver_id, snap.avg_passenger_rating)
            snap = DriverStatsSnapshot(**{**snap.__dict__, "rating_percentile": pct})
        return snap

    async def refresh_all_active_drivers(self) -> int:
        await self._bind_tenant_rls()
        r = await self._session.execute(
            text("SELECT id FROM drivers WHERE tenant_id = :tenant AND status = 'active'"),
            {"tenant": str(self._tenant_id)},
        )
        count = 0
        for row in r.mappings():
            await self.refresh_cache(UUID(str(row["id"])))
            count += 1
        return count

    async def _load_cache(self, driver_id: UUID):
        r = await self._session.execute(
            text("""
                SELECT total_kms_driven, total_hours_driven, assignments_count,
                       avg_passenger_rating, trips_completed, feedback_count, computed_at
                FROM driver_stats_cache
                WHERE driver_id = :driver AND tenant_id = :tenant
            """),
            {"driver": str(driver_id), "tenant": str(self._tenant_id)},
        )
        return r.mappings().first()

    async def _rating_percentile(self, driver_id: UUID, avg_rating: float) -> float | None:
        r = await self._session.execute(
            text("""
                WITH driver_avgs AS (
                    SELECT da.driver_id, AVG(sf.rating)::float AS avg_r
                    FROM driver_assignments da
                    JOIN bookings b ON b.trip_id = da.trip_id
                    JOIN stop_feedback sf ON sf.booking_id = b.id
                    WHERE da.tenant_id = :tenant AND da.status = 'completed'
                    GROUP BY da.driver_id
                )
                SELECT
                    CASE WHEN COUNT(*) = 0 THEN NULL
                    ELSE 100.0 * COUNT(*) FILTER (WHERE avg_r <= :my_avg) / COUNT(*)
                    END AS percentile
                FROM driver_avgs
            """),
            {"tenant": str(self._tenant_id), "my_avg": avg_rating},
        )
        val = r.scalar()
        return float(val) if val is not None else None

    def _cache_is_fresh(self, computed_at: datetime | None) -> bool:
        if not computed_at:
            return False
        if computed_at.tzinfo is None:
            computed_at = computed_at.replace(tzinfo=timezone.utc)
        age = datetime.now(timezone.utc) - computed_at
        return age.total_seconds() < self.CACHE_MAX_AGE_HOURS * 3600

    def _cache_row_to_snapshot(self, driver_id: UUID, row, *, cache_hit: bool) -> DriverStatsSnapshot:
        return DriverStatsSnapshot(
            driver_id=driver_id,
            total_kms_driven=Decimal(str(row["total_kms_driven"])),
            total_hours_driven=Decimal(str(row["total_hours_driven"])),
            assignments_count=int(row["assignments_count"]),
            avg_passenger_rating=float(row["avg_passenger_rating"]) if row["avg_passenger_rating"] else None,
            trips_completed=int(row["trips_completed"]),
            feedback_count=int(row["feedback_count"]),
            rating_percentile=None,
            computed_at=row["computed_at"],
            cache_hit=cache_hit,
        )
