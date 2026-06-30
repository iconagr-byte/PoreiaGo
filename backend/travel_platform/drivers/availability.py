"""
Availability engine — checks shift overlap, leave status, max hours per week.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import text

from core.base_service import TenantScopedService
from travel_platform.drivers.domain import DriverStatus


@dataclass(frozen=True)
class AvailabilityResult:
    available: bool
    reasons: list[str]
    conflicting_assignment_ids: list[str]


class DriverAvailabilityEngine(TenantScopedService):
    MAX_WEEKLY_HOURS = 48
    MIN_REST_HOURS_BETWEEN_SHIFTS = 11

    async def check_availability(
        self,
        driver_id: UUID,
        shift_start: datetime,
        shift_end: datetime,
        *,
        exclude_assignment_id: UUID | None = None,
    ) -> AvailabilityResult:
        await self._bind_tenant_rls()
        reasons: list[str] = []
        conflicts: list[str] = []

        driver = await self._session.execute(
            text("SELECT status FROM drivers WHERE id = :id AND tenant_id = :tenant"),
            {"id": str(driver_id), "tenant": str(self._tenant_id)},
        )
        row = driver.mappings().first()
        if not row:
            return AvailabilityResult(False, ["driver_not_found"], [])
        if row["status"] != DriverStatus.ACTIVE.value:
            reasons.append(f"driver_status_{row['status']}")

        overlap = await self._session.execute(
            text("""
                SELECT id FROM driver_assignments
                WHERE driver_id = :driver AND tenant_id = :tenant
                  AND status NOT IN ('cancelled')
                  AND (:exclude IS NULL OR id != :exclude)
                  AND shift_start < :end AND shift_end > :start
            """),
            {
                "driver": str(driver_id),
                "tenant": str(self._tenant_id),
                "exclude": str(exclude_assignment_id) if exclude_assignment_id else None,
                "start": shift_start,
                "end": shift_end,
            },
        )
        for r in overlap.mappings():
            conflicts.append(str(r["id"]))
        if conflicts:
            reasons.append("shift_overlap")

        if await self._exceeds_weekly_hours(driver_id, shift_start, shift_end):
            reasons.append("max_weekly_hours_exceeded")

        if await self._insufficient_rest(driver_id, shift_start, exclude_assignment_id):
            reasons.append("insufficient_rest_between_shifts")

        doc_block = await self._has_expired_critical_documents(driver_id)
        if doc_block:
            reasons.append("expired_license_or_certificate")

        return AvailabilityResult(
            available=len(reasons) == 0,
            reasons=reasons,
            conflicting_assignment_ids=conflicts,
        )

    async def assign_trip(
        self,
        driver_id: UUID,
        trip_id: int,
        shift_start: datetime,
        shift_end: datetime,
        distance_km: float | None = None,
    ) -> UUID:
        from uuid import uuid4

        check = await self.check_availability(driver_id, shift_start, shift_end)
        if not check.available:
            from core.exceptions import PlatformError

            raise PlatformError(f"Driver unavailable: {', '.join(check.reasons)}")

        aid = uuid4()
        await self._bind_tenant_rls()
        await self._session.execute(
            text("""
                INSERT INTO driver_assignments (
                    id, tenant_id, driver_id, trip_id, shift_start, shift_end, distance_km, status
                )
                VALUES (:id, :tenant, :driver, :trip, :start, :end, :km, 'scheduled')
            """),
            {
                "id": str(aid),
                "tenant": str(self._tenant_id),
                "driver": str(driver_id),
                "trip": trip_id,
                "start": shift_start,
                "end": shift_end,
                "km": distance_km,
            },
        )
        await self._audit(
            "driver.assigned",
            "driver_assignment",
            str(aid),
            metadata={"trip_id": trip_id, "driver_id": str(driver_id)},
        )
        return aid

    async def _exceeds_weekly_hours(
        self,
        driver_id: UUID,
        shift_start: datetime,
        shift_end: datetime,
    ) -> bool:
        week_start = shift_start - timedelta(days=shift_start.weekday())
        week_end = week_start + timedelta(days=7)
        proposed_hours = (shift_end - shift_start).total_seconds() / 3600

        r = await self._session.execute(
            text("""
                SELECT COALESCE(SUM(
                    EXTRACT(EPOCH FROM (shift_end - shift_start)) / 3600.0
                ), 0) AS hours
                FROM driver_assignments
                WHERE driver_id = :driver AND tenant_id = :tenant
                  AND status NOT IN ('cancelled')
                  AND shift_start >= :wstart AND shift_start < :wend
            """),
            {
                "driver": str(driver_id),
                "tenant": str(self._tenant_id),
                "wstart": week_start,
                "wend": week_end,
            },
        )
        existing = float(r.scalar() or 0)
        return (existing + proposed_hours) > self.MAX_WEEKLY_HOURS

    async def _insufficient_rest(
        self,
        driver_id: UUID,
        shift_start: datetime,
        exclude_id: UUID | None,
    ) -> bool:
        r = await self._session.execute(
            text("""
                SELECT shift_end FROM driver_assignments
                WHERE driver_id = :driver AND tenant_id = :tenant
                  AND status NOT IN ('cancelled')
                  AND shift_end <= :start
                  AND (:exclude IS NULL OR id != :exclude)
                ORDER BY shift_end DESC LIMIT 1
            """),
            {
                "driver": str(driver_id),
                "tenant": str(self._tenant_id),
                "start": shift_start,
                "exclude": str(exclude_id) if exclude_id else None,
            },
        )
        prev_end = r.scalar()
        if not prev_end:
            return False
        if isinstance(prev_end, datetime) and prev_end.tzinfo is None:
            prev_end = prev_end.replace(tzinfo=timezone.utc)
        if shift_start.tzinfo is None:
            shift_start = shift_start.replace(tzinfo=timezone.utc)
        rest_hours = (shift_start - prev_end).total_seconds() / 3600
        return rest_hours < self.MIN_REST_HOURS_BETWEEN_SHIFTS

    async def _has_expired_critical_documents(self, driver_id: UUID) -> bool:
        r = await self._session.execute(
            text("""
                SELECT 1 FROM driver_documents
                WHERE driver_id = :driver AND tenant_id = :tenant
                  AND doc_type IN ('driving_license', 'professional_certificate')
                  AND expires_at < CURRENT_DATE
                LIMIT 1
            """),
            {"driver": str(driver_id), "tenant": str(self._tenant_id)},
        )
        return r.scalar() is not None
