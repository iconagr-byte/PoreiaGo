"""Tests for fiscal invoice retry."""

from __future__ import annotations

import unittest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.models.fiscal_invoice import FiscalInvoiceStatus


class FiscalRetryServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_retry_resets_failed_invoice_and_dispatches(self):
        from app.models.booking import BookingStatus, PaymentStatus
        from app.services.fiscal_retry_service import FiscalRetryService

        tenant_id = uuid4()
        booking_id = uuid4()
        invoice_id = uuid4()
        invoice = SimpleNamespace(
            id=invoice_id,
            tenant_id=tenant_id,
            booking_id=booking_id,
            status=FiscalInvoiceStatus.FAILED,
            error_message="API down",
            aade_submission_id=uuid4(),
            invoice_kind=SimpleNamespace(value="full_payment"),
            amount=Decimal("50"),
            aade_mark=None,
            metadata_json={},
            created_at=SimpleNamespace(strftime=lambda *a, **k: "2026-01-01"),
        )
        booking = SimpleNamespace(
            id=booking_id,
            tenant_id=tenant_id,
            reference_code="BK-1",
            passenger_name="Test",
            passenger_email="t@example.com",
            total_price=Decimal("50"),
            amount_paid=Decimal("50"),
            amount_eur=Decimal("50"),
            fiscal_mark=None,
            metadata_json={},
            customer_user_id=None,
            seat_label="1A",
            notes=None,
            status=BookingStatus.PAID,
            payment_status=PaymentStatus.PAID,
            currency="EUR",
            created_at=SimpleNamespace(strftime=lambda *a, **k: "2026-01-01"),
        )

        session = AsyncMock()
        inv_result = MagicMock()
        inv_result.scalar_one_or_none.return_value = invoice
        booking_result = MagicMock()
        booking_result.scalar_one_or_none.return_value = booking
        all_inv_result = MagicMock()
        all_inv_result.scalars.return_value.all.return_value = [invoice]

        session.execute = AsyncMock(side_effect=[inv_result, booking_result, all_inv_result])

        with (
            patch("app.services.fiscal_retry_service.apply_tenant_rls", new_callable=AsyncMock),
            patch("app.services.fiscal_retry_service.dispatch_fiscal_receipt") as dispatch,
        ):
            svc = FiscalRetryService(session)
            result = await svc.retry_invoice(tenant_id=tenant_id, invoice_id=invoice_id)

        self.assertEqual(result.status, FiscalInvoiceStatus.PENDING)
        self.assertIsNone(invoice.error_message)
        self.assertIsNone(invoice.aade_submission_id)
        dispatch.assert_called_once_with(str(invoice_id))


if __name__ == "__main__":
    unittest.main()
