"""
Monthly payout summary — accounting-ready export (mock gateway pattern).
"""

from __future__ import annotations

from calendar import monthrange
from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import text

from core.base_service import TenantScopedService
from travel_platform.drivers.domain import MonthlyPayoutSummary
from travel_platform.drivers.registry import DriverRegistryService


class AccountingExportGateway:
    """Mock integration point for ERP / accounting software."""

    def format_payout(self, summary: MonthlyPayoutSummary) -> dict:
        return {
            "format": summary.export_format,
            "employee_ref": str(summary.driver_id),
            "period": f"{summary.period_start.isoformat()}/{summary.period_end.isoformat()}",
            "gross_earnings": str(summary.total_earnings),
            "reimbursable_expenses": str(summary.total_expenses),
            "deductions": str(summary.advances_and_deductions),
            "net_pay": str(summary.net_payout),
            "line_items": summary.line_items,
            "status": "ready_for_export",
        }


class DriverPayrollService(TenantScopedService):
    def __init__(self, *args, export_gateway: AccountingExportGateway | None = None, **kwargs):
        super().__init__(*args, **kwargs)
        self._export = export_gateway or AccountingExportGateway()

    async def monthly_payout_summary(
        self,
        driver_id: UUID,
        year: int,
        month: int,
    ) -> MonthlyPayoutSummary:
        await self._bind_tenant_rls()
        period_start = date(year, month, 1)
        last_day = monthrange(year, month)[1]
        period_end = date(year, month, last_day)

        earnings = await self._sum_table(
            "driver_earnings", driver_id, period_start, period_end
        )
        expenses = await self._sum_table(
            "driver_expenses", driver_id, period_start, period_end
        )
        advances = await self._sum_ledger(
            driver_id, period_start, period_end, ("advance", "deduction", "payout")
        )

        trip_count = await self._trip_count(driver_id, period_start, period_end)
        line_items = await self._line_items(driver_id, period_start, period_end)

        net = earnings - expenses - advances

        summary = MonthlyPayoutSummary(
            driver_id=driver_id,
            period_start=period_start,
            period_end=period_end,
            total_earnings=earnings,
            total_expenses=expenses,
            advances_and_deductions=advances,
            net_payout=net,
            trip_count=trip_count,
            line_items=line_items,
        )
        await self._audit(
            "driver.payout_summary_generated",
            "driver",
            str(driver_id),
            metadata={"year": year, "month": month, "net": str(net)},
            financial=True,
        )
        return summary

    async def export_for_accounting(
        self,
        driver_id: UUID,
        year: int,
        month: int,
    ) -> dict:
        summary = await self.monthly_payout_summary(driver_id, year, month)
        driver = await DriverRegistryService(self.session, self.tenant_id).get_driver(driver_id)
        payload = self._export.format_payout(summary)
        payload["driver_name"] = driver.personal_info.name
        payload["license_no"] = driver.personal_info.license_no
        return payload

    async def _sum_table(
        self,
        table: str,
        driver_id: UUID,
        start: date,
        end: date,
    ) -> Decimal:
        r = await self._session.execute(
            text(f"""
                SELECT COALESCE(SUM(amount), 0) FROM {table}
                WHERE driver_id = :driver AND tenant_id = :tenant
                  AND created_at::date BETWEEN :start AND :end
            """),
            {
                "driver": str(driver_id),
                "tenant": str(self._tenant_id),
                "start": start,
                "end": end,
            },
        )
        return Decimal(str(r.scalar()))

    async def _sum_ledger(
        self,
        driver_id: UUID,
        start: date,
        end: date,
        types: tuple[str, ...],
    ) -> Decimal:
        r = await self._session.execute(
            text("""
                SELECT COALESCE(SUM(ABS(amount)), 0) FROM driver_balance_ledger
                WHERE driver_id = :driver AND tenant_id = :tenant
                  AND entry_type = ANY(:types)
                  AND created_at::date BETWEEN :start AND :end
            """),
            {
                "driver": str(driver_id),
                "tenant": str(self._tenant_id),
                "types": list(types),
                "start": start,
                "end": end,
            },
        )
        return Decimal(str(r.scalar()))

    async def _trip_count(self, driver_id: UUID, start: date, end: date) -> int:
        r = await self._session.execute(
            text("""
                SELECT COUNT(*) FROM driver_assignments
                WHERE driver_id = :driver AND tenant_id = :tenant
                  AND status = 'completed'
                  AND shift_start::date BETWEEN :start AND :end
            """),
            {"driver": str(driver_id), "tenant": str(self._tenant_id), "start": start, "end": end},
        )
        return int(r.scalar() or 0)

    async def _line_items(self, driver_id: UUID, start: date, end: date) -> list[dict]:
        r = await self._session.execute(
            text("""
                SELECT 'earning' AS kind, earning_type AS label, amount, created_at::date AS d
                FROM driver_earnings
                WHERE driver_id = :driver AND tenant_id = :tenant
                  AND created_at::date BETWEEN :start AND :end
                UNION ALL
                SELECT 'expense', category, amount, created_at::date
                FROM driver_expenses
                WHERE driver_id = :driver AND tenant_id = :tenant
                  AND created_at::date BETWEEN :start AND :end
                ORDER BY d
            """),
            {"driver": str(driver_id), "tenant": str(self._tenant_id), "start": start, "end": end},
        )
        return [dict(row) for row in r.mappings()]
