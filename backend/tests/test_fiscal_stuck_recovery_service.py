"""Tests for stuck fiscal receipt recovery."""

from __future__ import annotations

import unittest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.models.fiscal_invoice import FiscalInvoiceStatus


class FiscalStuckRecoveryServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_redispatches_stuck_pending_invoice(self):
        from app.services.fiscal_stuck_recovery_service import FiscalStuckRecoveryService

        tenant_id = uuid4()
        invoice_id = uuid4()
        invoice = SimpleNamespace(
            id=invoice_id,
            tenant_id=tenant_id,
            status=FiscalInvoiceStatus.PENDING,
            amount=Decimal("55"),
            metadata_json={},
            updated_at=SimpleNamespace(),
        )

        inv_result = MagicMock()
        inv_result.scalars.return_value.all.return_value = [invoice]

        session = AsyncMock()
        session.execute = AsyncMock(return_value=inv_result)
        session.flush = AsyncMock()

        with (
            patch("app.services.fiscal_stuck_recovery_service.apply_tenant_rls", new_callable=AsyncMock),
            patch("app.services.fiscal_stuck_recovery_service.dispatch_fiscal_receipt") as dispatch,
        ):
            stats = await FiscalStuckRecoveryService(session, stuck_minutes=45).run_for_tenant(tenant_id)

        self.assertEqual(stats["redispatched"], 1)
        dispatch.assert_called_once_with(str(invoice_id))
        self.assertIn("stuck_recovery_at", invoice.metadata_json)

    async def test_no_candidates_returns_zero(self):
        from app.services.fiscal_stuck_recovery_service import FiscalStuckRecoveryService

        tenant_id = uuid4()
        inv_result = MagicMock()
        inv_result.scalars.return_value.all.return_value = []

        session = AsyncMock()
        session.execute = AsyncMock(return_value=inv_result)

        with patch("app.services.fiscal_stuck_recovery_service.apply_tenant_rls", new_callable=AsyncMock):
            stats = await FiscalStuckRecoveryService(session).run_for_tenant(tenant_id)

        self.assertEqual(stats["candidates"], 0)
        self.assertEqual(stats["redispatched"], 0)


if __name__ == "__main__":
    unittest.main()
