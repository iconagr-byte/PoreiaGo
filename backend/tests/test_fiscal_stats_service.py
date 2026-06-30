"""Tests for fiscal stats aggregation."""

from __future__ import annotations

import unittest
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.models.fiscal_invoice import FiscalInvoiceStatus
from app.services.fiscal_stats_service import build_daily_series


class BuildDailySeriesTests(unittest.TestCase):
    def test_fills_missing_days_with_zeros(self):
        today = date.today()
        day = datetime.combine(today - timedelta(days=1), datetime.min.time()).replace(tzinfo=timezone.utc)
        rows = [SimpleNamespace(day=day, issued=3, failed=1, issued_amount=Decimal("120"))]
        series = build_daily_series(rows, days=3)
        self.assertEqual(len(series), 3)
        issued_bucket = next((d for d in series if d["issued"] == 3), None)
        self.assertIsNotNone(issued_bucket)
        self.assertEqual(issued_bucket["failed"], 1)
        self.assertEqual(series[0]["issued"], 0)


class FiscalStatsServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_summary_maps_row_to_metrics(self):
        from app.services.fiscal_stats_service import FiscalStatsService

        tenant_id = uuid4()
        row = SimpleNamespace(
            issued=18,
            failed=2,
            pending=1,
            queued=3,
            issued_amount=Decimal("2450.50"),
            issued_last_7_days=6,
        )
        result = MagicMock()
        result.one.return_value = row

        session = AsyncMock()
        session.execute = AsyncMock(return_value=result)

        with patch("app.services.fiscal_stats_service.apply_tenant_rls", new_callable=AsyncMock):
            svc = FiscalStatsService(session)
            svc.get_daily_history = AsyncMock(return_value=[{"date": "2026-06-09", "issued": 1, "failed": 0, "amount_eur": 50.0, "label": "09/06"}])
            stats = await svc.get_summary(tenant_id, days=30)

        self.assertEqual(stats["issued"], 18)
        self.assertIn("daily", stats)
        self.assertEqual(len(stats["daily"]), 1)
        self.assertEqual(stats["failed"], 2)
        self.assertEqual(stats["open"], 6)
        self.assertEqual(stats["issued_amount_eur"], 2450.50)
        self.assertEqual(stats["issued_last_7_days"], 6)
        self.assertEqual(stats["success_rate_pct"], 90.0)
        self.assertEqual(stats["health"], "degraded")

    async def test_success_rate_none_when_no_completed(self):
        from app.services.fiscal_stats_service import FiscalStatsService

        tenant_id = uuid4()
        row = SimpleNamespace(
            issued=0,
            failed=0,
            pending=2,
            queued=1,
            issued_amount=Decimal("0"),
            issued_last_7_days=0,
        )
        result = MagicMock()
        result.one.return_value = row

        session = AsyncMock()
        session.execute = AsyncMock(return_value=result)

        with patch("app.services.fiscal_stats_service.apply_tenant_rls", new_callable=AsyncMock):
            stats = await FiscalStatsService(session).get_summary(tenant_id)

        self.assertIsNone(stats["success_rate_pct"])
        self.assertEqual(stats["health"], "busy")


if __name__ == "__main__":
    unittest.main()
