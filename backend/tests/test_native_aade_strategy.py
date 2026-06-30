"""Tests for NativeAADEStrategy XML builder and response parser."""

from __future__ import annotations

import unittest
from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock

from core.exceptions import FiscalAPIError
from travel_platform.compliance.fiscal_common import compute_invoice_amounts
from travel_platform.compliance.fiscal_models import BookingFiscalData, FiscalDocumentCategory
from travel_platform.compliance.native_aade_strategy import NativeAADEStrategy


def _sample_data(**overrides):
    base = dict(
        issuer_vat="123456789",
        series="ΑΠΥ",
        serial_number=42,
        issue_date=date(2026, 6, 9),
        document_category=FiscalDocumentCategory.RETAIL_RECEIPT,
        gross_amount=Decimal("124.00"),
        line_description="Εισιτήριο εκδρομής Μετέωρα",
        booking_reference="BK-001",
    )
    base.update(overrides)
    return BookingFiscalData(**base)


class InvoiceAmountMathTests(unittest.TestCase):
    def test_net_plus_vat_equals_gross(self):
        for gross in (Decimal("100.00"), Decimal("124.00"), Decimal("49.99"), Decimal("0.01")):
            amounts = compute_invoice_amounts(gross, Decimal("24"))
            self.assertEqual(amounts.net + amounts.vat, amounts.gross)

    def test_known_split_100_eur(self):
        amounts = compute_invoice_amounts(Decimal("100.00"), Decimal("24"))
        self.assertEqual(amounts.net, Decimal("80.65"))
        self.assertEqual(amounts.vat, Decimal("19.35"))
        self.assertEqual(amounts.gross, Decimal("100.00"))


class NativeAADEXmlBuilderTests(unittest.TestCase):
    def setUp(self):
        self.strategy = NativeAADEStrategy()

    def test_retail_receipt_maps_to_11_2(self):
        xml = self.strategy.build_xml_payload(_sample_data())
        self.assertIn("<invoiceType>11.2</invoiceType>", xml)
        self.assertIn("<totalGrossValue>124.00</totalGrossValue>", xml)

    def test_invoice_maps_to_2_1(self):
        xml = self.strategy.build_xml_payload(
            _sample_data(
                document_category=FiscalDocumentCategory.INVOICE,
                counterpart_vat="987654321",
                counterpart_name="Demo Travel SA",
            ),
        )
        self.assertIn("<invoiceType>2.1</invoiceType>", xml)
        self.assertIn("<counterpart>", xml)
        self.assertIn("<vatNumber>987654321</vatNumber>", xml)

    def test_summary_math_in_xml(self):
        data = _sample_data(gross_amount=Decimal("100.00"))
        xml = self.strategy.build_xml_payload(data)
        amounts = compute_invoice_amounts(data.gross_amount, data.vat_rate_percent)
        self.assertIn(f"<totalNetValue>{amounts.net:.2f}</totalNetValue>", xml)
        self.assertIn(f"<totalVatAmount>{amounts.vat:.2f}</totalVatAmount>", xml)
        self.assertIn(f"<totalGrossValue>{amounts.gross:.2f}</totalGrossValue>", xml)
        self.assertEqual(amounts.net + amounts.vat, amounts.gross)

    def test_xml_uses_element_tree_invoice_doc_root(self):
        xml = self.strategy.build_xml_payload(_sample_data())
        self.assertTrue(xml.startswith('<?xml version="1.0" encoding="UTF-8"?>'))
        self.assertIn("InvoicesDoc", xml)
        self.assertIn("invoiceSummary", xml)
        self.assertIn("paymentMethods", xml)


class NativeAADEResponseParserTests(unittest.TestCase):
    def test_parse_success_response(self):
        xml = """<?xml version="1.0" encoding="UTF-8"?>
        <ResponseDoc>
          <response>
            <statusCode>Success</statusCode>
            <invoiceUid>uid-abc-123456789012345678901234567890abcd</invoiceUid>
            <invoiceMark>400000012345678</invoiceMark>
          </response>
        </ResponseDoc>"""
        result = NativeAADEStrategy.parse_response_xml(xml)
        self.assertEqual(result.invoice_mark, "400000012345678")
        self.assertEqual(result.invoice_uid, "uid-abc-123456789012345678901234567890abcd")

    def test_parse_failure_raises_fiscal_api_error_with_message(self):
        xml = """<?xml version="1.0" encoding="UTF-8"?>
        <ResponseDoc>
          <response>
            <statusCode>ValidationError</statusCode>
            <errors>
              <error>
                <message>Invalid invoiceType for issuer</message>
              </error>
            </errors>
          </response>
        </ResponseDoc>"""
        with self.assertRaises(FiscalAPIError) as ctx:
            NativeAADEStrategy.parse_response_xml(xml)
        self.assertIn("Invalid invoiceType", str(ctx.exception))
        self.assertEqual(ctx.exception.code, "FISCAL_API_ERROR")


class NativeAADETransmitTests(unittest.IsolatedAsyncioTestCase):
    async def test_transmit_posts_xml_and_returns_mark(self):
        strategy = NativeAADEStrategy(api_url="https://example.test/SendInvoices")
        mock_response = AsyncMock()
        mock_response.text = """
        <ResponseDoc><response>
          <statusCode>Success</statusCode>
          <invoiceUid>uid-test</invoiceUid>
          <invoiceMark>999</invoiceMark>
        </response></ResponseDoc>"""
        mock_response.raise_for_status = lambda: None

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        strategy_with_client = NativeAADEStrategy(
            api_url="https://example.test/SendInvoices",
            client=mock_client,
        )
        result = await strategy_with_client.transmit(
            _sample_data(),
            {"aade_user_id": "user", "aade_subscription_key": "key"},
        )
        self.assertEqual(result.invoice_mark, "999")
        mock_client.post.assert_awaited_once()
        posted_xml = mock_client.post.await_args.kwargs["content"]
        self.assertIn("<invoiceType>11.2</invoiceType>", posted_xml)

    async def test_transmit_requires_credentials(self):
        strategy = NativeAADEStrategy(api_url="https://example.test/SendInvoices")
        with self.assertRaises(FiscalAPIError):
            await strategy.transmit(_sample_data(), {})


if __name__ == "__main__":
    unittest.main()
