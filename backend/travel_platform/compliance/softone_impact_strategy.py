"""
SoftOne / Impact eINVOICING adapter (shared EliseCore JSON API).

Auth: POST /Authentication/login {vat, key} → accessToken
Send: POST /Invoice/json?sendMethod=A  Authorization: Bearer …

Docs: https://developers.s1ecos.com/
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import httpx

from core.exceptions import FiscalAPIError
from travel_platform.compliance.fiscal_common import (
    FiscalProviderResult,
    build_success_result,
    compute_invoice_amounts,
    format_amount_float,
)
from travel_platform.compliance.fiscal_models import (
    BookingFiscalData,
    FiscalDocumentCategory,
    FiscalProvider,
    PlatformPaymentMethod,
)
from travel_platform.compliance.fiscal_tenant_config import EinvoicingTenantConfig

logger = logging.getLogger(__name__)

_PAYMENT_CODES: dict[PlatformPaymentMethod, tuple[str, int]] = {
    PlatformPaymentMethod.CASH: ("ΜΕΤΡΗΤΑ", 3),
    PlatformPaymentMethod.CREDIT_CARD: ("ΚΑΡΤΑ", 7),
    PlatformPaymentMethod.BANK_TRANSFER: ("ΤΡΑΠΕΖΙΚΗ ΚΑΤΑΘΕΣΗ", 1),
    PlatformPaymentMethod.PAYPAL: ("WEB", 5),
    PlatformPaymentMethod.ON_CREDIT: ("ΕΠΙ ΠΙΣΤΩΣΕΙ", 5),
    PlatformPaymentMethod.ESHOP: ("WEB BANKING", 5),
}


class SoftOneImpactStrategy:
    """SoftOne eINVOICING + Impact EINVOICING (same API family)."""

    def __init__(
        self,
        *,
        provider: FiscalProvider,
        timeout: float = 45.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        if provider not in (FiscalProvider.SOFTONE, FiscalProvider.IMPACT):
            raise ValueError(f"Unsupported einvoicing provider: {provider}")
        self._provider = provider
        self._timeout = timeout
        self._client = client

    def build_json_payload(
        self,
        data: BookingFiscalData,
        config: EinvoicingTenantConfig,
    ) -> dict[str, Any]:
        amounts = compute_invoice_amounts(data.gross_amount, data.vat_rate_percent)
        is_retail = data.document_category in (
            FiscalDocumentCategory.RETAIL_RECEIPT,
            FiscalDocumentCategory.CREDIT_NOTE_RETAIL,
        )
        is_credit = data.document_category in (
            FiscalDocumentCategory.CREDIT_NOTE_RETAIL,
            FiscalDocumentCategory.CREDIT_NOTE_INVOICE,
        )
        invoice_type_code = data.invoice_type
        if is_retail and not is_credit:
            invoice_type = "Retail Sales Receipt"
            document_type_code = "RECEIPT"
        elif is_credit and is_retail:
            invoice_type = "Credit Note Retail"
            document_type_code = "CREDIT"
        elif is_credit:
            invoice_type = "Credit Invoice"
            document_type_code = "CREDIT"
        else:
            invoice_type = "Service Rendered Invoice"
            document_type_code = "INVOICE"

        pay_label, pay_code = _PAYMENT_CODES.get(
            data.resolved_payment_method,
            ("ΜΕΤΡΗΤΑ", 3),
        )
        issued_at = datetime.combine(data.issue_date, datetime.min.time()).strftime("%Y-%m-%dT%H:%M:%S")
        issuer_name = (config.issuer_name or data.customer_name or "Issuer").strip() or "Issuer"
        counterpart_name = (data.counterpart_name or data.customer_name or "Πελάτης").strip()
        item_code = (config.item_code or data.service_item_code or "TRAVEL").strip()
        vat_pct = float(data.vat_rate_percent)
        vat_label = f"{int(vat_pct) if vat_pct == int(vat_pct) else vat_pct}%"

        issuer: dict[str, Any] = {
            "RegisteredName": issuer_name,
            "Vat": f"EL{data.issuer_vat}",
            "BranchCode": int(config.branch_code if config.branch_code is not None else data.issuer_branch or 0),
            "Address": {"CountryCode": data.issuer_country or "GR"},
        }
        counterparty: dict[str, Any] = {
            "RegisteredName": counterpart_name,
            "BranchCode": 0,
            "Address": {"CountryCode": data.counterpart_country or "GR"},
        }
        if data.counterpart_vat:
            counterparty["Vat"] = f"EL{data.counterpart_vat}"
        if data.customer_phone:
            counterparty["Phones"] = [str(data.customer_phone)]

        emails: list[str] = []
        if data.customer_email:
            emails.append(str(data.customer_email).strip())

        payload: dict[str, Any] = {
            "IAPRSignPolicy": 2,
            "CurrencyCode": data.currency or "EUR",
            "InvoiceType": invoice_type,
            "InvoiceTypeCode": invoice_type_code,
            "DocumentType": invoice_type,
            "DocumentTypeCode": document_type_code,
            "Series": str(data.series or "0"),
            "Number": str(data.serial_number),
            "DateIssued": issued_at,
            "Issuer": issuer,
            "CounterParty": counterparty,
            "DistributionDetails": {
                "InternalDocumentId": data.booking_reference or f"{data.series}-{data.serial_number}",
            },
            "PaymentDetails": {
                "PaymentMethods": [
                    {
                        "PaymentMethodType": pay_label,
                        "PaymentMethodTypeCode": pay_code,
                        "amount": format_amount_float(data.resolved_payment_amount),
                    }
                ]
            },
            "AdditionalDetails": {
                "TransmissionMethod": "A",
                "AvoidEmailGrouping": False,
                "accountingDepartmentEmails": emails,
            },
            "Details": [
                {
                    "LineNo": 1,
                    "Code": item_code,
                    "Descriptions": [data.line_description or "Υπηρεσία μεταφοράς / ενοικίασης"],
                    "MeasurementUnit": "ΤΕΜ",
                    "MeasurementUnitCode": 1,
                    "Quantity": 1,
                    "UnitPrice": format_amount_float(amounts.net),
                    "NetTotal": format_amount_float(amounts.net),
                    "Total": format_amount_float(amounts.gross),
                    "VATTotal": format_amount_float(amounts.vat),
                    "VatCategory": vat_label,
                    "VatCategoryCode": int(data.vat_category or 1),
                    "IsInformative": False,
                    "IsHidden": False,
                    "RecordTypeCode": 0,
                    "IncomeClassification": {
                        "ClassificationTypeCode": data.income_classification_type or "E3_561_003",
                        "ClassificationCategoryCode": data.income_classification_category or "category1_1",
                    },
                }
            ],
            "Summaries": {
                "TotalNetAmount": format_amount_float(amounts.net),
                "TotalVATAmount": format_amount_float(amounts.vat),
                "TotalGrossValue": format_amount_float(amounts.gross),
            },
            "VatAnalysis": [
                {
                    "Name": vat_label,
                    "Percentage": vat_pct,
                    "VatAmount": format_amount_float(amounts.vat),
                    "UnderlyingValue": format_amount_float(amounts.net),
                }
            ],
            "IsDelayedCode": 0,
        }
        return payload

    @classmethod
    def parse_response_json(cls, payload: Any, *, provider: str) -> FiscalProviderResult:
        if not isinstance(payload, dict):
            raise FiscalAPIError(f"{provider} returned unexpected response type")
        if payload.get("success") is False:
            raise FiscalAPIError(
                str(payload.get("message") or payload.get("errorMessage") or "einvoicing failed"),
                details={"provider": provider, "raw": payload},
            )
        mark = payload.get("mark") or payload.get("Mark")
        uid = payload.get("uid") or payload.get("UID") or ""
        if mark is None or str(mark).strip() == "":
            raise FiscalAPIError(f"{provider} response missing MARK", details={"raw": payload})
        return build_success_result(
            provider=provider,
            mark=str(mark),
            uid=str(uid or mark),
            document_id=str(uid or mark),
            raw=payload,
        )

    async def _login(self, client: httpx.AsyncClient, config: EinvoicingTenantConfig, issuer_vat: str) -> str:
        base = config.api_url.rstrip("/")
        url = f"{base}/Authentication/login"
        body = {"vat": issuer_vat if issuer_vat.startswith("EL") else f"EL{issuer_vat}", "key": config.api_key}
        # Some tenants store bare AFM without EL — API accepts both; try EL-prefixed first.
        response = await client.post(url, json=body, headers={"Content-Type": "application/json", "Accept": "application/json"})
        if response.status_code >= 400:
            # retry bare vat
            body["vat"] = issuer_vat.replace("EL", "", 1) if issuer_vat.startswith("EL") else issuer_vat
            response = await client.post(url, json=body, headers={"Content-Type": "application/json", "Accept": "application/json"})
        if response.status_code >= 400:
            try:
                problem = response.json()
            except Exception:
                problem = {"message": response.text}
            raise FiscalAPIError(
                f"{self._provider.value} login failed: {problem.get('message') or response.status_code}",
                details={"provider": self._provider.value, "status": response.status_code, "raw": problem},
            )
        data = response.json()
        token = data.get("accessToken") or data.get("access_token")
        if not token:
            raise FiscalAPIError(f"{self._provider.value} login missing accessToken")
        return str(token)

    async def test_login(self, config: EinvoicingTenantConfig, issuer_vat: str) -> dict[str, Any]:
        """Validate API URL + key against /Authentication/login (no invoice issued)."""
        if not config.api_key:
            raise FiscalAPIError(f"{self._provider.value} API key missing")
        if not config.api_url:
            raise FiscalAPIError(f"{self._provider.value} API URL missing")
        vat = str(issuer_vat or "").strip()
        if not vat:
            raise FiscalAPIError("Issuer VAT (ΑΦΜ) required for provider login")

        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=self._timeout)
        try:
            token = await self._login(client, config, vat)
            return {
                "ok": True,
                "provider": self._provider.value,
                "api_url": config.api_url.rstrip("/"),
                "token_received": bool(token),
                "message": "Επιτυχής σύνδεση στον πάροχο",
            }
        finally:
            if owns_client:
                await client.aclose()

    async def transmit(
        self,
        data: BookingFiscalData,
        config: EinvoicingTenantConfig,
    ) -> FiscalProviderResult:
        if not config.api_key:
            raise FiscalAPIError(f"{self._provider.value} API key missing")
        if not config.api_url:
            raise FiscalAPIError(f"{self._provider.value} API URL missing")

        payload = self.build_json_payload(data, config)
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=self._timeout)
        try:
            token = await self._login(client, config, data.issuer_vat)
            base = config.api_url.rstrip("/")
            url = f"{base}/Invoice/json"
            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": f"Bearer {token}",
                "APIKey": config.api_key,
            }
            logger.info("%s Invoice/json → %s series=%s aa=%s", self._provider.value, url, data.series, data.serial_number)
            response = await client.post(url, params={"sendMethod": "A"}, json=payload, headers=headers)
            try:
                body = response.json()
            except Exception:
                body = {"message": response.text}
            if response.status_code >= 400 and response.status_code != 201:
                raise FiscalAPIError(
                    str(body.get("message") or body.get("errorMessage") or f"HTTP {response.status_code}"),
                    details={"provider": self._provider.value, "status": response.status_code, "raw": body},
                )
            return self.parse_response_json(body, provider=self._provider.value)
        finally:
            if owns_client:
                await client.aclose()
