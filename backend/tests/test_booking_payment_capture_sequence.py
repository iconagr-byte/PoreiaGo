"""Cash/bank capture must not lazy-load booking.fiscal_invoices (async MissingGreenlet)."""

from __future__ import annotations

import unittest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4


class CaptureSequenceTests(unittest.IsolatedAsyncioTestCase):
    async def test_cash_capture_uses_count_query_not_relationship(self):
        from app.models.booking import Booking, BookingStatus, PaymentStatus
        from app.services.booking_payment_service import BookingPaymentService
        from travel_platform.payments.cash_payment_confirm import CashPaymentChannel

        booking = Booking(
            id=uuid4(),
            tenant_id=uuid4(),
            reference_code="BK-TEST01",
            passenger_name="Maria",
            passenger_email="m@example.com",
            total_price=Decimal("64.60"),
            amount_paid=Decimal("0"),
            amount_eur=Decimal("64.60"),
            status=BookingStatus.CONFIRMED,
            payment_status=PaymentStatus.PENDING,
            metadata_json={},
        )

        # Accessing the relationship must explode (simulates async MissingGreenlet).
        type(booking).fiscal_invoices = property(
            lambda self: (_ for _ in ()).throw(
                RuntimeError("MissingGreenlet: unexpected IO on fiscal_invoices")
            )
        )

        session = AsyncMock()
        added = []

        def _add(obj):
            added.append(obj)
            if getattr(obj, "id", None) is None:
                obj.id = uuid4()

        session.add = MagicMock(side_effect=_add)
        session.flush = AsyncMock()

        async def _execute(stmt):
            result = MagicMock()
            text = str(stmt).lower()
            if "count" in text:
                result.scalar_one.return_value = 2
                result.scalar_one_or_none.return_value = 2
                return result
            if "fiscal_invoice" in text or "fiscal_invoices" in text:
                result.scalar_one_or_none.return_value = None
                return result
            result.scalar_one_or_none.return_value = booking
            return result

        session.execute = AsyncMock(side_effect=_execute)

        with patch(
            "app.services.booking_payment_service.apply_tenant_rls",
            new_callable=AsyncMock,
        ):
            svc = BookingPaymentService(session)
            result = await svc.record_cash_payment(
                tenant_id=booking.tenant_id,
                booking_id=booking.id,
                amount=Decimal("64.60"),
                channel=CashPaymentChannel.DRIVER_ON_BUS,
            )

        self.assertEqual(result.status, "captured")
        self.assertTrue(added)
        self.assertEqual(added[0].metadata_json.get("capture_sequence"), 3)


if __name__ == "__main__":
    unittest.main()
