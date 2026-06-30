"""Tests for fiscal Prometheus metrics."""

from __future__ import annotations

import os
import unittest
from unittest.mock import AsyncMock, patch


class FiscalMetricsTests(unittest.TestCase):
    def setUp(self) -> None:
        os.environ["METRICS_ENABLED"] = "true"

    def tearDown(self) -> None:
        os.environ.pop("METRICS_ENABLED", None)
        import app.observability.fiscal_metrics as fm

        fm._ENABLED = None

    def test_apply_fiscal_snapshot_sets_gauges(self) -> None:
        from app.observability.fiscal_metrics import (
            FISCAL_INVOICES,
            FISCAL_OPEN,
            FISCAL_STUCK_CANDIDATES,
            apply_fiscal_snapshot,
        )

        apply_fiscal_snapshot(
            {
                "pending": 2,
                "queued": 1,
                "issued": 10,
                "failed": 3,
                "open": 6,
                "stuck_candidates": 4,
            },
        )

        self.assertEqual(FISCAL_STUCK_CANDIDATES._value.get(), 4.0)
        self.assertEqual(FISCAL_OPEN._value.get(), 6.0)
        self.assertEqual(FISCAL_INVOICES.labels(status="failed")._value.get(), 3.0)

    def test_record_fiscal_dispatch_increments(self) -> None:
        from app.observability.fiscal_metrics import FISCAL_DISPATCH_TOTAL, record_fiscal_dispatch

        before = FISCAL_DISPATCH_TOTAL.labels(transport="celery")._value.get()
        record_fiscal_dispatch("celery")
        after = FISCAL_DISPATCH_TOTAL.labels(transport="celery")._value.get()
        self.assertEqual(after, before + 1.0)

    def test_record_provider_call_observes_histogram(self) -> None:
        from app.observability.fiscal_metrics import (
            FISCAL_PROVIDER_DURATION,
            FISCAL_PROVIDER_ERRORS,
            record_provider_call,
        )

        record_provider_call(provider="native_aade", duration_seconds=0.42, success=True)
        record_provider_call(provider="native_aade", duration_seconds=1.5, success=False)

        self.assertGreater(
            FISCAL_PROVIDER_DURATION.labels(provider="native_aade")._sum.get(),
            0.0,
        )
        self.assertEqual(
            FISCAL_PROVIDER_ERRORS.labels(provider="native_aade")._value.get(),
            1.0,
        )

    def test_metrics_disabled_is_noop(self) -> None:
        os.environ["METRICS_ENABLED"] = "false"
        import app.observability.fiscal_metrics as fm

        fm._ENABLED = None
        from app.observability.fiscal_metrics import record_fiscal_dispatch, record_fiscal_processing

        record_fiscal_dispatch("celery")
        record_fiscal_processing(outcome="issued", provider="x", invoice_kind="full_payment")


class FiscalMetricsSyncTests(unittest.IsolatedAsyncioTestCase):
    async def test_refresh_fiscal_gauges_applies_snapshot(self) -> None:
        os.environ["METRICS_ENABLED"] = "true"
        session = AsyncMock()
        snapshot = {
            "pending": 1,
            "queued": 0,
            "issued": 5,
            "failed": 2,
            "open": 3,
            "stuck_candidates": 1,
        }

        with patch(
            "app.services.platform_health_service.fiscal_pipeline_snapshot",
            new=AsyncMock(return_value=snapshot),
        ):
            from app.observability.metrics_sync import refresh_fiscal_gauges

            await refresh_fiscal_gauges(session)

        from app.observability.fiscal_metrics import FISCAL_OPEN

        self.assertEqual(FISCAL_OPEN._value.get(), 3.0)
        os.environ.pop("METRICS_ENABLED", None)


if __name__ == "__main__":
    unittest.main()
