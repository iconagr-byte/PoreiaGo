"""Aggregate fiscal receipt metrics for admin dashboards."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_deps import apply_tenant_rls
from app.models.fiscal_invoice import FiscalInvoice, FiscalInvoiceStatus


def _pct(numerator: int, denominator: int) -> float | None:
    if denominator <= 0:
        return 100.0 if numerator > 0 else None
    return round((numerator / denominator) * 100, 1)


def build_daily_series(rows: list, *, days: int) -> list[dict[str, Any]]:
    """Fill missing days with zeros for chart-friendly time series."""
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)
    by_day: dict[str, dict[str, float | int]] = {}

    for row in rows:
        raw_day = getattr(row, "day", None) or row[0]
        if hasattr(raw_day, "date"):
            day_key = raw_day.date().isoformat()
        else:
            day_key = str(raw_day)[:10]

        issued = int(getattr(row, "issued", None) or row[1] or 0)
        failed = int(getattr(row, "failed", None) or row[2] or 0)
        amount = Decimal(str(getattr(row, "issued_amount", None) or row[3] or 0)).quantize(Decimal("0.01"))
        by_day[day_key] = {
            "issued": issued,
            "failed": failed,
            "amount_eur": float(amount),
        }

    series: list[dict[str, Any]] = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        key = day.isoformat()
        bucket = by_day.get(key, {"issued": 0, "failed": 0, "amount_eur": 0.0})
        series.append(
            {
                "date": key,
                "label": day.strftime("%d/%m"),
                "issued": int(bucket["issued"]),
                "failed": int(bucket["failed"]),
                "amount_eur": float(bucket["amount_eur"]),
            },
        )
    return series


class FiscalStatsService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_summary(self, tenant_id: UUID, *, days: int = 30) -> dict[str, Any]:
        await apply_tenant_rls(self._session, tenant_id)
        window_start = datetime.now(timezone.utc) - timedelta(days=days)
        week_start = datetime.now(timezone.utc) - timedelta(days=7)

        issued_case = case((FiscalInvoice.status == FiscalInvoiceStatus.ISSUED, 1), else_=0)
        failed_case = case((FiscalInvoice.status == FiscalInvoiceStatus.FAILED, 1), else_=0)
        pending_case = case((FiscalInvoice.status == FiscalInvoiceStatus.PENDING, 1), else_=0)
        queued_case = case((FiscalInvoice.status == FiscalInvoiceStatus.QUEUED, 1), else_=0)
        issued_amount_case = case(
            (FiscalInvoice.status == FiscalInvoiceStatus.ISSUED, FiscalInvoice.amount),
            else_=0,
        )
        issued_week_case = case(
            (
                and_(
                    FiscalInvoice.status == FiscalInvoiceStatus.ISSUED,
                    FiscalInvoice.updated_at >= week_start,
                ),
                1,
            ),
            else_=0,
        )

        result = await self._session.execute(
            select(
                func.coalesce(func.sum(issued_case), 0).label("issued"),
                func.coalesce(func.sum(failed_case), 0).label("failed"),
                func.coalesce(func.sum(pending_case), 0).label("pending"),
                func.coalesce(func.sum(queued_case), 0).label("queued"),
                func.coalesce(func.sum(issued_amount_case), 0).label("issued_amount"),
                func.coalesce(func.sum(issued_week_case), 0).label("issued_last_7_days"),
            ).where(
                FiscalInvoice.tenant_id == tenant_id,
                FiscalInvoice.created_at >= window_start,
            ),
        )
        row = result.one()

        issued = int(row.issued or 0)
        failed = int(row.failed or 0)
        pending = int(row.pending or 0)
        queued = int(row.queued or 0)
        open_count = pending + queued + failed
        completed = issued + failed
        amount = Decimal(str(row.issued_amount or 0)).quantize(Decimal("0.01"))
        chart_days = min(days, 14)
        daily = await self.get_daily_history(tenant_id, days=chart_days)
        pipeline = await self.get_pipeline_health(tenant_id)

        return {
            "window_days": days,
            "issued": issued,
            "failed": failed,
            "pending": pending,
            "queued": queued,
            "open": open_count,
            "issued_last_7_days": int(row.issued_last_7_days or 0),
            "issued_amount_eur": float(amount),
            "success_rate_pct": _pct(issued, completed),
            "health": "ok" if failed == 0 and open_count == 0 else ("degraded" if failed > 0 else "busy"),
            "daily": daily,
            **pipeline,
        }

    async def get_pipeline_health(self, tenant_id: UUID) -> dict[str, Any]:
        from app.services.fiscal_auto_retry_service import fiscal_auto_retry_settings
        from app.services.fiscal_stuck_recovery_service import fiscal_stuck_recovery_settings

        stuck_settings = fiscal_stuck_recovery_settings()
        stuck_minutes = int(stuck_settings["stuck_minutes"])
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=stuck_minutes)

        stuck_result = await self._session.execute(
            select(func.count())
            .select_from(FiscalInvoice)
            .where(
                FiscalInvoice.tenant_id == tenant_id,
                FiscalInvoice.status.in_(
                    (FiscalInvoiceStatus.PENDING, FiscalInvoiceStatus.QUEUED),
                ),
                FiscalInvoice.updated_at <= cutoff,
            ),
        )
        stuck_candidates = int(stuck_result.scalar() or 0)

        oldest_result = await self._session.execute(
            select(func.min(FiscalInvoice.updated_at)).where(
                FiscalInvoice.tenant_id == tenant_id,
                FiscalInvoice.status.in_(
                    (
                        FiscalInvoiceStatus.PENDING,
                        FiscalInvoiceStatus.QUEUED,
                        FiscalInvoiceStatus.FAILED,
                    ),
                ),
            ),
        )
        oldest_open = oldest_result.scalar()
        oldest_open_minutes: int | None = None
        if oldest_open:
            if oldest_open.tzinfo is None:
                oldest_open = oldest_open.replace(tzinfo=timezone.utc)
            oldest_open_minutes = int(
                (datetime.now(timezone.utc) - oldest_open).total_seconds() // 60,
            )

        auto_settings = fiscal_auto_retry_settings()
        return {
            "stuck_candidates": stuck_candidates,
            "oldest_open_minutes": oldest_open_minutes,
            "pipeline": {
                "auto_retry_enabled": bool(auto_settings["enabled"]),
                "auto_retry_max": int(auto_settings["max_retries"]),
                "stuck_recovery_enabled": bool(stuck_settings["enabled"]),
                "stuck_after_minutes": stuck_minutes,
            },
        }

    async def get_daily_history(self, tenant_id: UUID, *, days: int = 14) -> list[dict[str, Any]]:
        await apply_tenant_rls(self._session, tenant_id)
        window_start = datetime.now(timezone.utc) - timedelta(days=days - 1)
        day_col = func.date_trunc("day", FiscalInvoice.updated_at).label("day")
        issued_case = case((FiscalInvoice.status == FiscalInvoiceStatus.ISSUED, 1), else_=0)
        failed_case = case((FiscalInvoice.status == FiscalInvoiceStatus.FAILED, 1), else_=0)
        issued_amount_case = case(
            (FiscalInvoice.status == FiscalInvoiceStatus.ISSUED, FiscalInvoice.amount),
            else_=0,
        )

        result = await self._session.execute(
            select(
                day_col,
                func.coalesce(func.sum(issued_case), 0).label("issued"),
                func.coalesce(func.sum(failed_case), 0).label("failed"),
                func.coalesce(func.sum(issued_amount_case), 0).label("issued_amount"),
            )
            .where(
                FiscalInvoice.tenant_id == tenant_id,
                FiscalInvoice.updated_at >= window_start,
                FiscalInvoice.status.in_((FiscalInvoiceStatus.ISSUED, FiscalInvoiceStatus.FAILED)),
            )
            .group_by(day_col)
            .order_by(day_col),
        )
        return build_daily_series(list(result.all()), days=days)
