"""Tests for FiscalFactory."""

from __future__ import annotations

import json
import unittest
from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import core.exceptions  # noqa: F401 — bootstrap import order

from travel_platform.compliance.fiscal_factory import FiscalFactory
from travel_platform.compliance.fiscal_models import (
    BookingFiscalData,
    FiscalDocumentCategory,
    FiscalProvider,
    PlatformPaymentMethod,
)


def _sample_data() -> BookingFiscalData:
    return BookingFiscalData(
        issuer_vat="123456789",
        series="ΑΠΥ",
        serial_number=42,
        issue_date=date.today(),
        document_category=FiscalDocumentCategory.RETAIL_RECEIPT,
        gross_amount=Decimal("50.00"),
        vat_rate_percent=Decimal("24"),
        line_description="Προκαταβολή — Test",
        payment_method=PlatformPaymentMethod.CREDIT_CARD,
        booking_reference="BK-1",
    )


class FiscalFactoryTests(unittest.IsolatedAsyncioTestCase):
    def test_defaults_to_native_aade_without_config(self):
        factory = FiscalFactory.from_tenant_settings(None)
        self.assertEqual(factory.provider, FiscalProvider.NATIVE_AADE)

    def test_reads_prosvasis_provider_from_settings(self):
        settings = json.dumps({"fiscal": {"provider": "prosvasis", "prosvasis": {"app_id": "1"}}})
        factory = FiscalFactory.from_tenant_settings(settings)
        self.assertEqual(factory.provider, FiscalProvider.PROSVASIS)

    async def test_issue_invoice_delegates_to_transmit(self):
        factory = FiscalFactory.from_tenant_settings(None, native_credentials={"aade_user_id": "u"})
        data = _sample_data()
        with patch(
            "travel_platform.compliance.fiscal_factory.transmit_booking_fiscal",
            new_callable=AsyncMock,
        ) as transmit:
            transmit.return_value = {"success": True, "mark": "M-1", "uid": "U-1", "provider": "native_aade"}
            result = await factory.issue_invoice(data)
        transmit.assert_awaited_once()
        self.assertEqual(result["mark"], "M-1")


if __name__ == "__main__":
    unittest.main()
