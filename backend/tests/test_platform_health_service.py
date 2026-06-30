"""Tests for platform health / fiscal snapshot."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, MagicMock

from app.models.fiscal_invoice import FiscalInvoiceStatus
from app.services.platform_health_service import (
    fiscal_pipeline_snapshot,
    resolve_overall_status,
)


class PlatformHealthServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_fiscal_snapshot_ok_when_empty(self):
        session = AsyncMock()

        def _scalar_zero():
            result = MagicMock()
            result.scalar.return_value = 0
            return result

        statuses = list(FiscalInvoiceStatus)
        session.execute = AsyncMock(side_effect=[_scalar_zero() for _ in range(len(statuses) + 1)])
        snapshot = await fiscal_pipeline_snapshot(session)

        self.assertEqual(snapshot["health"], "ok")
        self.assertEqual(snapshot["failed"], 0)
        self.assertIn("pipeline", snapshot)

    def test_resolve_overall_status(self):
        self.assertEqual(
            resolve_overall_status(db_status="ok", redis_status="ok", fiscal_health="ok"),
            "ok",
        )
        self.assertEqual(
            resolve_overall_status(db_status="ok", redis_status="fail", fiscal_health="ok"),
            "degraded",
        )
        self.assertEqual(
            resolve_overall_status(db_status="fail", redis_status="ok", fiscal_health="ok"),
            "unhealthy",
        )
        self.assertEqual(
            resolve_overall_status(db_status="ok", redis_status="ok", fiscal_health="degraded"),
            "degraded",
        )


if __name__ == "__main__":
    unittest.main()
