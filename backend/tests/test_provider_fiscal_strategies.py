"""Tests for ProsvasisStrategy and EpsilonStrategy."""

from __future__ import annotations

import json
import unittest
from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

from core.exceptions import FiscalAPIError
from travel_platform.compliance.epsilon_strategy import EpsilonStrategy
from travel_platform.compliance.fiscal_mappings import (
    map_payment_to_epsilon,
    map_payment_to_prosvasis,
    map_vat_category_to_epsilon_status,
)
from travel_platform.compliance.fiscal_models import (
    BookingFiscalData,
    FiscalDocumentCategory,
    FiscalProvider,
    PlatformPaymentMethod,
)
from travel_platform.compliance.fiscal_tenant_config import load_tenant_fiscal_config
from travel_platform.compliance.prosvasis_strategy import ProsvasisStrategy


def _sample_data(**overrides):
    base = dict(
        issuer_vat="123456789",
        series="ΑΠΥ",
        serial_number=7,
        issue_date=date(2026, 6, 9),
        document_category=FiscalDocumentCategory.RETAIL_RECEIPT,
        gross_amount=Decimal("124.00"),
        line_description="Εισιτήριο εκδρομής",
        booking_reference="BK-007",
        payment_method=PlatformPaymentMethod.CREDIT_CARD,
        customer_name="Maria Papadopoulou",
    )
    base.update(overrides)
    return BookingFiscalData(**base)


class FiscalMappingTests(unittest.TestCase):
    def test_credit_card_maps_to_epsilon_payment_id_2(self):
        self.assertEqual(map_payment_to_epsilon(PlatformPaymentMethod.CREDIT_CARD), 2)

    def test_cash_maps_to_prosvasis_payment_code(self):
        self.assertEqual(map_payment_to_prosvasis(PlatformPaymentMethod.CASH), "1001")

    def test_vat_category_1_is_epsilon_normal_regime(self):
        self.assertEqual(map_vat_category_to_epsilon_status(1), 0)


class ProsvasisPayloadTests(unittest.TestCase):
    def setUp(self):
        self.strategy = ProsvasisStrategy()
        self.config = type(
            "Cfg",
            (),
            {
                "api_url": "https://go.s1cloud.net",
                "app_id": "703",
                "s1code": "10502454783619",
                "bearer_token": "secret-token",
                "series_retail": 7001,
                "series_invoice": 7021,
                "branch": 1000,
                "default_trdr": 1,
                "service_mtrl_code": "SRV-TRAVEL",
                "payment_codes": {"credit_card": "1003"},
            },
        )()

    def test_build_json_payload_uses_retail_series_and_payment_code(self):
        payload = self.strategy.build_json_payload(_sample_data(), self.config)
        saldoc = payload["data"]["SALDOC"][0]
        self.assertEqual(saldoc["SERIES"], 7001)
        self.assertEqual(saldoc["PAYMENT"], "1003")
        self.assertEqual(saldoc["CMPFINCODE"], "BK-007")
        self.assertEqual(payload["appId"], "703")
        self.assertEqual(payload["token"], "secret-token")

    def test_parse_success_response_returns_unified_fields(self):
        response = {
            "success": True,
            "id": 99881,
            "data": {"SALDOC": [{"CMPFINCODE": "400000012345678", "FINDOC": "uid-abc"}]},
        }
        result = ProsvasisStrategy.parse_response_json(response)
        self.assertTrue(result["success"])
        self.assertEqual(result["provider"], FiscalProvider.PROSVASIS.value)
        self.assertEqual(result["document_id"], "99881")
        self.assertEqual(result["mark"], "400000012345678")
        self.assertEqual(result["uid"], "uid-abc")


class EpsilonPayloadTests(unittest.TestCase):
    def setUp(self):
        self.strategy = EpsilonStrategy()
        self.config = type(
            "Cfg",
            (),
            {
                "smart_url": "https://epsilonsmart.epsilonnet.gr/",
                "bearer_token": "jwt-token",
                "subscription_key": None,
                "retail_item_code": "ΕΙΔ-TRAVEL",
                "wholesale_item_code": "SRV-TRAVEL",
            },
        )()

    def test_build_json_payload_maps_credit_card_and_vat(self):
        docs = self.strategy.build_json_payload(_sample_data(), self.config)
        doc = docs[0]
        self.assertEqual(doc["PaymentMethod"], 2)
        self.assertEqual(doc["VatStatus"], 0)
        self.assertEqual(doc["IsRetail"], 1)
        self.assertEqual(doc["RefDocCode"], "BK-007")
        self.assertEqual(doc["Lines"][0]["ItemCode"], "ΕΙΔ-TRAVEL")

    def test_parse_success_response(self):
        payload = [
            {
                "RefDocCode": "BK-007",
                "SmartDocId": "1621fa94-3e8e-43a8-b0af-946314e8cfe7",
                "Mark": "400000099999999",
            },
        ]
        result = EpsilonStrategy.parse_response_json(payload, ref_doc_code="BK-007")
        self.assertTrue(result["success"])
        self.assertEqual(result["provider"], FiscalProvider.EPSILON.value)
        self.assertEqual(result["uid"], "1621fa94-3e8e-43a8-b0af-946314e8cfe7")
        self.assertEqual(result["mark"], "400000099999999")

    def test_parse_failure_raises_fiscal_api_error(self):
        payload = [{"RefDocCode": "BK-007", "ErrorMessage": "Invalid VAT status"}]
        with self.assertRaises(FiscalAPIError) as ctx:
            EpsilonStrategy.parse_response_json(payload, ref_doc_code="BK-007")
        self.assertIn("Invalid VAT status", str(ctx.exception))


class ProviderTransmitTests(unittest.IsolatedAsyncioTestCase):
    async def test_prosvasis_transmit_uses_bearer_header(self):
        strategy = ProsvasisStrategy(api_url="https://example.test")
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "success": True,
            "id": 55,
            "data": {"SALDOC": [{"CMPFINCODE": "MARK-55", "FINDOC": "UID-55"}]},
        }
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        config = type(
            "Cfg",
            (),
            {
                "api_url": "https://example.test",
                "app_id": "703",
                "s1code": "user-1",
                "bearer_token": "bearer-xyz",
                "series_retail": 7001,
                "series_invoice": 7021,
                "branch": 1000,
                "default_trdr": 1,
                "service_mtrl_code": None,
                "payment_codes": None,
            },
        )()

        result = await ProsvasisStrategy(api_url="https://example.test", client=mock_client).transmit(
            _sample_data(),
            config,
        )
        self.assertTrue(result["success"])
        headers = mock_client.post.await_args.kwargs["headers"]
        self.assertEqual(headers["Authorization"], "Bearer bearer-xyz")
        self.assertEqual(result["mark"], "MARK-55")

    async def test_epsilon_transmit_posts_insert_documents(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"RefDocCode": "BK-007", "SmartDocId": "doc-1", "Mark": "9001"},
        ]

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        config = type(
            "Cfg",
            (),
            {
                "smart_url": "https://epsilon.example/",
                "bearer_token": "jwt-1",
                "subscription_key": "sub-1",
                "retail_item_code": "ITEM",
                "wholesale_item_code": None,
            },
        )()

        result = await EpsilonStrategy(client=mock_client).transmit(_sample_data(), config)
        self.assertEqual(result["provider"], "epsilon")
        self.assertEqual(result["uid"], "doc-1")
        posted_url = mock_client.post.await_args.args[0]
        self.assertIn("api/Eshop/InsertDocuments", posted_url)


class TenantFiscalConfigTests(unittest.TestCase):
    def test_load_plaintext_tenant_config(self):
        settings = {
            "fiscal": {
                "provider": "prosvasis",
                "prosvasis": {
                    "app_id": "703",
                    "s1code": "user",
                    "bearer_token": "token",
                    "series_retail": 7001,
                    "series_invoice": 7021,
                },
            },
        }
        cfg = load_tenant_fiscal_config(json.dumps(settings))
        assert cfg is not None
        self.assertEqual(cfg.provider, FiscalProvider.PROSVASIS)
        self.assertEqual(cfg.prosvasis.bearer_token, "token")


if __name__ == "__main__":
    unittest.main()
