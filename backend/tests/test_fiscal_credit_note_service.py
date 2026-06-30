"""Tests for fiscal credit notes on booking cancellation."""

from __future__ import annotations

import unittest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.models.fiscal_invoice import FiscalInvoiceKind, FiscalInvoiceStatus


class FiscalCreditNoteServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_creates_credit_note_for_issued_invoice(self):
        from app.services.fiscal_credit_note_service import FiscalCreditNoteService

        tenant_id = uuid4()
        booking_id = uuid4()
        original_id = uuid4()

        booking = SimpleNamespace(
            id=booking_id,
            tenant_id=tenant_id,
            reference_code="BK-CN1",
            metadata_json={"trip_title": "Trip"},
            passenger_vat_id=None,
        )
        original = SimpleNamespace(
            id=original_id,
            tenant_id=tenant_id,
            booking_id=booking_id,
            status=FiscalInvoiceStatus.ISSUED,
            aade_mark="MARK-ORIG",
            amount=Decimal("50"),
            currency="EUR",
            invoice_kind=SimpleNamespace(value=FiscalInvoiceKind.FULL_PAYMENT.value),
            idempotency_key="pi-orig",
            metadata_json={"aade_payload": {"document_type": "receipt"}},
        )

        booking_result = MagicMock()
        booking_result.scalar_one_or_none.return_value = booking
        inv_result = MagicMock()
        inv_result.scalars.return_value.all.return_value = [original]

        session = AsyncMock()
        session.execute = AsyncMock(side_effect=[booking_result, inv_result])
        session.add = MagicMock()
        session.flush = AsyncMock()

        created_invoice = SimpleNamespace(id=uuid4())

        async def _fake_issue(_id):
            return created_invoice

        with (
            patch("app.services.fiscal_credit_note_service.apply_tenant_rls", new_callable=AsyncMock),
            patch("app.services.fiscal_credit_note_service.record_fiscal_audit") as audit,
            patch(
                "app.services.fiscal_credit_note_service.FiscalInvoiceService",
            ) as invoice_svc_cls,
        ):
            invoice_svc_cls.return_value.issue_to_aade = AsyncMock(side_effect=_fake_issue)

            def _capture_add(obj):
                nonlocal created_invoice
                created_invoice = obj

            session.add.side_effect = _capture_add

            svc = FiscalCreditNoteService(session)
            ids = await svc.create_for_cancelled_booking(
                tenant_id=tenant_id,
                booking_id=booking_id,
            )

        self.assertEqual(len(ids), 1)
        audit.assert_called_once()
        self.assertEqual(created_invoice.invoice_kind, FiscalInvoiceKind.CREDIT_NOTE)
        self.assertEqual(created_invoice.idempotency_key, f"credit-note:{original_id}")

    async def test_skips_when_credit_already_exists(self):
        from app.services.fiscal_credit_note_service import FiscalCreditNoteService

        tenant_id = uuid4()
        booking_id = uuid4()
        original_id = uuid4()

        booking = SimpleNamespace(
            id=booking_id,
            tenant_id=tenant_id,
            reference_code="BK-CN2",
            metadata_json={},
            passenger_vat_id=None,
        )
        original = SimpleNamespace(
            id=original_id,
            tenant_id=tenant_id,
            booking_id=booking_id,
            status=FiscalInvoiceStatus.ISSUED,
            aade_mark="MARK-2",
            amount=Decimal("30"),
            currency="EUR",
            invoice_kind=FiscalInvoiceKind.FULL_PAYMENT,
            idempotency_key="pi-2",
            metadata_json={},
        )
        existing_credit = SimpleNamespace(
            id=uuid4(),
            invoice_kind=FiscalInvoiceKind.CREDIT_NOTE,
            idempotency_key=f"credit-note:{original_id}",
            status=FiscalInvoiceStatus.PENDING,
            aade_mark=None,
            metadata_json={"credited_invoice_id": str(original_id)},
        )

        booking_result = MagicMock()
        booking_result.scalar_one_or_none.return_value = booking
        inv_result = MagicMock()
        inv_result.scalars.return_value.all.return_value = [original, existing_credit]

        session = AsyncMock()
        session.execute = AsyncMock(side_effect=[booking_result, inv_result])

        with patch("app.services.fiscal_credit_note_service.apply_tenant_rls", new_callable=AsyncMock):
            svc = FiscalCreditNoteService(session)
            ids = await svc.create_for_cancelled_booking(
                tenant_id=tenant_id,
                booking_id=booking_id,
            )

        self.assertEqual(ids, [])


if __name__ == "__main__":
    unittest.main()
