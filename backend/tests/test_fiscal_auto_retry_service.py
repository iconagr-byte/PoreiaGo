"""Tests for scheduled fiscal auto-retry."""

from __future__ import annotations

import unittest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.models.fiscal_invoice import FiscalInvoiceStatus


class FiscalAutoRetryServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_skips_when_auto_retry_limit_reached(self):
        from app.services.fiscal_auto_retry_service import FiscalAutoRetryService

        tenant_id = uuid4()
        invoice_id = uuid4()
        invoice = SimpleNamespace(
            id=invoice_id,
            tenant_id=tenant_id,
            status=FiscalInvoiceStatus.FAILED,
            amount=Decimal("40"),
            metadata_json={"auto_retry_count": 3},
            updated_at=SimpleNamespace(),
        )

        inv_result = MagicMock()
        inv_result.scalars.return_value.all.return_value = [invoice]

        session = AsyncMock()
        session.execute = AsyncMock(return_value=inv_result)

        with patch("app.services.fiscal_auto_retry_service.apply_tenant_rls", new_callable=AsyncMock):
            stats = await FiscalAutoRetryService(session, max_retries=3).run_for_tenant(tenant_id)

        self.assertEqual(stats["skipped"], 1)
        self.assertEqual(stats["retried"], 0)

    async def test_retries_eligible_failed_invoice(self):
        from app.services.fiscal_auto_retry_service import FiscalAutoRetryService

        tenant_id = uuid4()
        invoice_id = uuid4()
        invoice = SimpleNamespace(
            id=invoice_id,
            tenant_id=tenant_id,
            status=FiscalInvoiceStatus.FAILED,
            amount=Decimal("40"),
            metadata_json={},
            updated_at=SimpleNamespace(),
        )

        inv_result = MagicMock()
        inv_result.scalars.return_value.all.return_value = [invoice]

        session = AsyncMock()
        session.execute = AsyncMock(return_value=inv_result)
        session.flush = AsyncMock()

        retry_mock = AsyncMock()
        with (
            patch("app.services.fiscal_auto_retry_service.apply_tenant_rls", new_callable=AsyncMock),
            patch("app.services.fiscal_auto_retry_service.FiscalRetryService") as retry_cls,
        ):
            retry_cls.return_value.retry_invoice = retry_mock
            stats = await FiscalAutoRetryService(session, max_retries=3).run_for_tenant(tenant_id)

        self.assertEqual(stats["retried"], 1)
        retry_mock.assert_awaited_once_with(
            tenant_id=tenant_id,
            invoice_id=invoice_id,
            trigger="auto",
        )
        self.assertEqual(invoice.metadata_json["auto_retry_count"], 1)


if __name__ == "__main__":
    unittest.main()
