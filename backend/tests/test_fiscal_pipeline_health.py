"""Tests for fiscal pipeline health fields in stats."""

from __future__ import annotations

import unittest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4


class FiscalPipelineHealthTests(unittest.IsolatedAsyncioTestCase):
    async def test_summary_includes_pipeline_health(self):
        from app.services.fiscal_stats_service import FiscalStatsService

        tenant_id = uuid4()
        row = SimpleNamespace(
            issued=10,
            failed=1,
            pending=2,
            queued=1,
            issued_amount=Decimal("500"),
            issued_last_7_days=3,
        )
        result = MagicMock()
        result.one.return_value = row

        stuck_scalar = MagicMock()
        stuck_scalar.scalar.return_value = 2
        oldest_scalar = MagicMock()
        oldest_scalar.scalar.return_value = None

        session = AsyncMock()
        session.execute = AsyncMock(side_effect=[result, stuck_scalar, oldest_scalar])

        with (
            patch("app.services.fiscal_stats_service.apply_tenant_rls", new_callable=AsyncMock),
            patch.object(FiscalStatsService, "get_daily_history", new_callable=AsyncMock, return_value=[]),
            patch.object(
                FiscalStatsService,
                "get_pipeline_health",
                new_callable=AsyncMock,
                return_value={
                    "stuck_candidates": 2,
                    "oldest_open_minutes": 120,
                    "pipeline": {"auto_retry_enabled": True, "stuck_recovery_enabled": True},
                },
            ),
        ):
            stats = await FiscalStatsService(session).get_summary(tenant_id, days=30)

        self.assertEqual(stats["stuck_candidates"], 2)
        self.assertTrue(stats["pipeline"]["auto_retry_enabled"])


if __name__ == "__main__":
    unittest.main()
