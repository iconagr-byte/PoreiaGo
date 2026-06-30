"""Tests for manual fiscal receipt issuance."""

from __future__ import annotations

import unittest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.models.fiscal_invoice import FiscalInvoiceKind, FiscalInvoiceStatus


class FiscalManualIssueServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_issue_missing_receipt_creates_invoice_and_dispatches(self):
        from app.models.booking import BookingStatus, PaymentStatus
        from app.services.fiscal_manual_issue_service import FiscalManualIssueService

        tenant_id = uuid4()
        booking_id = uuid4()
        booking = SimpleNamespace(
            id=booking_id,
            tenant_id=tenant_id,
            reference_code="BK-200",
            passenger_name="Test",
            passenger_email="t@example.com",
            total_price=Decimal("100"),
            amount_paid=Decimal("50"),
            amount_eur=Decimal("100"),
            fiscal_mark=None,
            metadata_json={},
            customer_user_id=None,
            seat_label="1A",
            notes=None,
            status=BookingStatus.CONFIRMED,
            payment_status=PaymentStatus.PARTIAL,
            currency="EUR",
            created_at=SimpleNamespace(strftime=lambda *a, **k: "2026-01-01"),
        )

        session = AsyncMock()
        booking_result = MagicMock()
        booking_result.scalar_one_or_none.return_value = booking
        empty_inv_result = MagicMock()
        empty_inv_result.scalars.return_value.all.return_value = []
        refreshed_inv_result = MagicMock()
        created_invoice = SimpleNamespace(
            id=uuid4(),
            invoice_kind=FiscalInvoiceKind.DOWN_PAYMENT,
            status=FiscalInvoiceStatus.PENDING,
            amount=Decimal("50"),
            currency="EUR",
            aade_mark=None,
            error_message=None,
            metadata_json={"channel": "manual"},
            created_at=SimpleNamespace(strftime=lambda *a, **k: "2026-01-01"),
        )
        refreshed_inv_result.scalars.return_value.all.return_value = [created_invoice]

        session.execute = AsyncMock(
            side_effect=[booking_result, empty_inv_result, refreshed_inv_result],
        )

        with (
            patch("app.services.fiscal_manual_issue_service.apply_tenant_rls", new_callable=AsyncMock),
            patch("app.services.fiscal_manual_issue_service.dispatch_fiscal_receipt") as dispatch,
            patch("app.services.fiscal_manual_issue_service.record_fiscal_audit") as audit,
            patch(
                "app.services.fiscal_manual_issue_service.booking_to_admin_dict",
                return_value={"id": "BK-200", "fiscal_receipts": []},
            ),
        ):
            svc = FiscalManualIssueService(session)
            result = await svc.issue_missing_receipt(
                tenant_id=tenant_id,
                booking_id=booking_id,
                actor_id="admin-1",
            )

        session.add.assert_called_once()
        added = session.add.call_args[0][0]
        self.assertEqual(added.amount, Decimal("50"))
        self.assertEqual(added.invoice_kind, FiscalInvoiceKind.DOWN_PAYMENT)
        dispatch.assert_called_once()
        audit.assert_called_once()
        self.assertEqual(audit.call_args.kwargs["action"], "fiscal_manual_issue")
        self.assertEqual(result["id"], "BK-200")

    async def test_issue_rejects_when_no_payment(self):
        from app.services.fiscal_manual_issue_service import FiscalManualIssueService

        tenant_id = uuid4()
        booking_id = uuid4()
        booking = SimpleNamespace(
            id=booking_id,
            tenant_id=tenant_id,
            amount_paid=Decimal("0"),
            total_price=Decimal("100"),
            currency="EUR",
        )

        session = AsyncMock()
        booking_result = MagicMock()
        booking_result.scalar_one_or_none.return_value = booking
        session.execute = AsyncMock(return_value=booking_result)

        with patch("app.services.fiscal_manual_issue_service.apply_tenant_rls", new_callable=AsyncMock):
            svc = FiscalManualIssueService(session)
            with self.assertRaises(ValueError) as ctx:
                await svc.issue_missing_receipt(tenant_id=tenant_id, booking_id=booking_id)
        self.assertIn("no captured payments", str(ctx.exception).lower())

    async def test_issue_rejects_when_failed_receipts_exist(self):
        from app.services.fiscal_manual_issue_service import FiscalManualIssueService

        tenant_id = uuid4()
        booking_id = uuid4()
        booking = SimpleNamespace(
            id=booking_id,
            tenant_id=tenant_id,
            amount_paid=Decimal("50"),
            total_price=Decimal("50"),
            currency="EUR",
        )
        failed_invoice = SimpleNamespace(status=FiscalInvoiceStatus.FAILED, amount=Decimal("50"))

        session = AsyncMock()
        booking_result = MagicMock()
        booking_result.scalar_one_or_none.return_value = booking
        inv_result = MagicMock()
        inv_result.scalars.return_value.all.return_value = [failed_invoice]
        session.execute = AsyncMock(side_effect=[booking_result, inv_result])

        with patch("app.services.fiscal_manual_issue_service.apply_tenant_rls", new_callable=AsyncMock):
            svc = FiscalManualIssueService(session)
            with self.assertRaises(ValueError) as ctx:
                await svc.issue_missing_receipt(tenant_id=tenant_id, booking_id=booking_id)
        self.assertIn("retry", str(ctx.exception).lower())


if __name__ == "__main__":
    unittest.main()
