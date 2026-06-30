"""E2E tests: fiscal pipeline → Native AADE (mock HTTP + optional live sandbox)."""

from __future__ import annotations

import os
import unittest
from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.models.aade import AadeSubmissionStatus
from app.models.fiscal_invoice import FiscalInvoiceKind, FiscalInvoiceStatus
from tests.fiscal_aade_fixtures import aade_success_response_xml, aade_validation_error_xml


def _mock_aade_http_client(*, mark: str = "MARK-E2E-9001", uid: str = "uid-e2e-flow-abcdefghijklmnopqrstuvwxyz12"):
    mock_response = AsyncMock()
    mock_response.text = aade_success_response_xml(mark=mark, uid=uid)
    mock_response.raise_for_status = lambda: None
    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.aclose = AsyncMock()
    return mock_client


class FiscalTransmissionAadeE2ETests(unittest.IsolatedAsyncioTestCase):
    async def test_transmit_submission_e2e_mock_aade_http(self):
        """Full FiscalTransmissionService path with real XML + mocked AADE HTTP."""
        from app.models.booking import PaymentStatus
        from app.services.fiscal_transmission_service import FiscalTransmissionService

        submission_id = uuid4()
        tenant_id = uuid4()
        booking_id = uuid4()
        invoice_id = uuid4()
        mark = "MARK-E2E-9001"
        uid = "uid-e2e-flow-abcdefghijklmnopqrstuvwxyz12"

        submission = SimpleNamespace(
            id=submission_id,
            tenant_id=tenant_id,
            booking_id=booking_id,
            status=AadeSubmissionStatus.QUEUED,
            mark=None,
            aade_uid=None,
            payload_json={
                "amount_eur": "80.00",
                "vat_rate": "24",
                "booking_reference": "BK-E2E1",
                "line_items": [{"description": "E2E Trip"}],
            },
        )
        booking = SimpleNamespace(
            id=booking_id,
            reference_code="BK-E2E1",
            passenger_name="E2E Guest",
            passenger_email="e2e@example.com",
            passenger_vat_id=None,
            payment_status=PaymentStatus.PAID,
            metadata_json={"payment_method": "card", "trip_title": "Meteora"},
            fiscal_mark=None,
        )
        invoice = SimpleNamespace(
            id=invoice_id,
            tenant_id=tenant_id,
            booking_id=booking_id,
            amount=Decimal("80.00"),
            invoice_kind=FiscalInvoiceKind.FULL_PAYMENT,
            status=FiscalInvoiceStatus.QUEUED,
            aade_submission_id=submission_id,
            aade_mark=None,
            metadata_json={},
            error_message=None,
        )
        tenant = SimpleNamespace(
            settings_json='{"fiscal":{"issuer_vat":"802963132","series_retail":"ΑΠΥ","provider":"native_aade"}}',
        )

        submission_result = MagicMock()
        submission_result.scalar_one_or_none.return_value = submission
        booking_result = MagicMock()
        booking_result.scalar_one_or_none.return_value = booking
        invoice_result = MagicMock()
        invoice_result.scalar_one_or_none.return_value = invoice
        tenant_result = MagicMock()
        tenant_result.scalar_one_or_none.return_value = tenant
        apply_row = MagicMock()
        apply_row.one_or_none.return_value = (invoice, booking)

        session = AsyncMock()
        session.execute = AsyncMock(
            side_effect=[submission_result, booking_result, invoice_result, tenant_result, apply_row],
        )
        session.flush = AsyncMock()

        mock_client = _mock_aade_http_client(mark=mark, uid=uid)

        with (
            patch(
                "app.services.fiscal_transmission_service.load_native_aade_credentials",
                new_callable=AsyncMock,
                return_value={"aade_user_id": "e2e-user", "aade_subscription_key": "e2e-key"},
            ),
            patch(
                "travel_platform.compliance.native_aade_strategy.httpx.AsyncClient",
                return_value=mock_client,
            ),
        ):
            svc = FiscalTransmissionService(session)
            queue = AsyncMock()
            queue.mark_processing = AsyncMock()
            queue.mark_accepted = AsyncMock()
            svc._queue = queue

            result = await svc.transmit_submission(submission_id)

        self.assertTrue(result["success"])
        self.assertEqual(result["mark"], mark)
        self.assertEqual(result["provider"], "native_aade")
        self.assertEqual(invoice.status, FiscalInvoiceStatus.ISSUED)
        self.assertEqual(invoice.aade_mark, mark)
        self.assertEqual(booking.fiscal_mark, mark)
        mock_client.post.assert_awaited_once()
        posted_xml = mock_client.post.await_args.kwargs["content"]
        self.assertIn("<invoiceType>11.2</invoiceType>", posted_xml)
        self.assertIn("<totalGrossValue>80.00</totalGrossValue>", posted_xml)
        queue.mark_processing.assert_awaited_once_with(submission_id)
        queue.mark_accepted.assert_awaited_once_with(submission_id, mark=mark, aade_uid=uid)

    async def test_process_fiscal_receipt_e2e_through_aade_mock(self):
        """Worker → transmission → Native AADE (HTTP mocked)."""
        from app.models.booking import PaymentStatus
        from app.workers.fiscal_receipt_worker import process_fiscal_receipt

        tenant_id = uuid4()
        booking_id = uuid4()
        invoice_id = uuid4()
        submission_id = uuid4()
        mark = "MARK-WORKER-E2E"

        invoice = SimpleNamespace(
            id=invoice_id,
            tenant_id=tenant_id,
            booking_id=booking_id,
            status=FiscalInvoiceStatus.QUEUED,
            invoice_kind=SimpleNamespace(value=FiscalInvoiceKind.FULL_PAYMENT.value),
            amount=Decimal("55.00"),
            aade_submission_id=submission_id,
            aade_mark=None,
            error_message=None,
            metadata_json={"channel": "stripe"},
        )
        booking = SimpleNamespace(
            id=booking_id,
            reference_code="BK-WE2E",
            passenger_name="Worker E2E",
            passenger_email="worker@example.com",
            payment_status=PaymentStatus.PAID,
            fiscal_mark=None,
        )
        tenant = SimpleNamespace(
            settings_json='{"fiscal":{"issuer_vat":"802963132","series_retail":"ΑΠΥ","provider":"native_aade"}}',
        )

        inv_result = MagicMock()
        inv_result.scalar_one_or_none.return_value = invoice
        tenant_result = MagicMock()
        tenant_result.scalar_one_or_none.return_value = tenant

        session = AsyncMock()
        session.execute = AsyncMock(side_effect=[inv_result, tenant_result])
        session.refresh = AsyncMock()
        session.flush = AsyncMock()

        async def _transmit(sub_id):
            invoice.status = FiscalInvoiceStatus.ISSUED
            invoice.aade_mark = mark
            booking.fiscal_mark = mark
            invoice.metadata_json = {**(invoice.metadata_json or {}), "fiscal_provider": "native_aade"}
            return {"success": True, "mark": mark, "uid": "uid-worker", "provider": "native_aade"}

        with (
            patch("app.workers.fiscal_receipt_worker.apply_tenant_rls", new_callable=AsyncMock),
            patch(
                "app.workers.fiscal_receipt_worker.load_native_aade_credentials",
                new_callable=AsyncMock,
                return_value={"aade_user_id": "e2e-user", "aade_subscription_key": "e2e-key"},
            ),
            patch("app.workers.fiscal_receipt_worker.FiscalInvoiceService") as invoice_svc_cls,
            patch("app.workers.fiscal_receipt_worker.FiscalTransmissionService") as tx_svc_cls,
            patch(
                "app.workers.fiscal_receipt_worker._notify_fiscal_receipt_issued",
                new_callable=AsyncMock,
            ),
        ):
            invoice_svc_cls.return_value.issue_to_aade = AsyncMock(return_value=invoice)
            tx_svc_cls.return_value.transmit_submission = AsyncMock(side_effect=_transmit)

            result = await process_fiscal_receipt(session, invoice_id)

        self.assertEqual(result["status"], "issued")
        self.assertEqual(result["mark"], mark)
        tx_svc_cls.return_value.transmit_submission.assert_awaited_once_with(submission_id)

    async def test_transmit_submission_surfaces_aade_validation_error(self):
        from app.services.fiscal_transmission_service import FiscalTransmissionService
        from core.exceptions import FiscalAPIError

        submission_id = uuid4()
        submission = SimpleNamespace(
            id=submission_id,
            tenant_id=uuid4(),
            booking_id=uuid4(),
            status=AadeSubmissionStatus.QUEUED,
            mark=None,
            aade_uid=None,
            payload_json={"amount_eur": "10"},
        )
        booking = SimpleNamespace(
            id=submission.booking_id,
            reference_code="BK-ERR",
            passenger_name="X",
            passenger_email="x@y.com",
            passenger_vat_id=None,
            metadata_json={},
        )
        invoice = SimpleNamespace(
            id=uuid4(),
            tenant_id=submission.tenant_id,
            booking_id=submission.booking_id,
            amount=Decimal("10"),
            invoice_kind=FiscalInvoiceKind.FULL_PAYMENT,
            metadata_json={},
        )
        tenant = SimpleNamespace(settings_json='{"fiscal":{"issuer_vat":"000000000"}}')

        submission_result = MagicMock()
        submission_result.scalar_one_or_none.return_value = submission
        booking_result = MagicMock()
        booking_result.scalar_one_or_none.return_value = booking
        invoice_result = MagicMock()
        invoice_result.scalar_one_or_none.return_value = invoice
        tenant_result = MagicMock()
        tenant_result.scalar_one_or_none.return_value = tenant

        session = AsyncMock()
        session.execute = AsyncMock(
            side_effect=[submission_result, booking_result, invoice_result, tenant_result],
        )

        mock_response = AsyncMock()
        mock_response.text = aade_validation_error_xml("Invalid issuer VAT")
        mock_response.raise_for_status = lambda: None
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.aclose = AsyncMock()

        with (
            patch(
                "app.services.fiscal_transmission_service.load_native_aade_credentials",
                new_callable=AsyncMock,
                return_value={"aade_user_id": "e2e-user", "aade_subscription_key": "e2e-key"},
            ),
            patch(
                "travel_platform.compliance.native_aade_strategy.httpx.AsyncClient",
                return_value=mock_client,
            ),
        ):
            svc = FiscalTransmissionService(session)
            svc._queue = AsyncMock()
            svc._queue.mark_processing = AsyncMock()

            with self.assertRaises(FiscalAPIError) as ctx:
                await svc.transmit_submission(submission_id)
        self.assertIn("Invalid issuer VAT", str(ctx.exception))


@unittest.skipUnless(
    os.getenv("AADE_E2E_LIVE", "").lower() in ("1", "true", "yes"),
    "Set AADE_E2E_LIVE=1 with AADE_USER_ID + AADE_SUBSCRIPTION_KEY for live sandbox",
)
class FiscalAadeLiveSandboxTests(unittest.IsolatedAsyncioTestCase):
    async def test_live_sandbox_send_invoices(self):
        """Posts one retail receipt to myDATA dev (mydataapidev.aade.gr)."""
        from travel_platform.compliance.fiscal_models import BookingFiscalData, FiscalDocumentCategory
        from travel_platform.compliance.native_aade_strategy import NativeAADEStrategy

        user_id = os.getenv("AADE_USER_ID", "").strip()
        sub_key = os.getenv("AADE_SUBSCRIPTION_KEY", "").strip()
        if not user_id or not sub_key:
            self.skipTest("AADE_USER_ID and AADE_SUBSCRIPTION_KEY required")

        issuer_vat = os.getenv("AADE_VAT_NUMBER", "802963132").strip()
        serial = int(os.getenv("AADE_E2E_SERIAL", str(uuid4().int % 900_000 + 100_000)))

        data = BookingFiscalData(
            issuer_vat=issuer_vat,
            series=os.getenv("AADE_E2E_SERIES", "ΑΠΥ"),
            serial_number=serial,
            issue_date=date.today(),
            document_category=FiscalDocumentCategory.RETAIL_RECEIPT,
            gross_amount=Decimal(os.getenv("AADE_E2E_AMOUNT", "1.00")),
            line_description="AeroStride E2E sandbox receipt",
            booking_reference=f"E2E-{serial}",
        )
        strategy = NativeAADEStrategy()
        result = await strategy.transmit(
            data,
            {"aade_user_id": user_id, "aade_subscription_key": sub_key},
        )
        self.assertTrue(result.invoice_mark)
        self.assertTrue(result.invoice_uid)
        print(f"LIVE AADE MARK={result.invoice_mark} UID={result.invoice_uid}")


if __name__ == "__main__":
    unittest.main()
