"""
Native AADE myDATA strategy — XML builder + httpx client.

Uses the official InvoicesDoc / AadeBookInvoiceType structure and posts to the
AADE development SendInvoices endpoint by default.
"""

from __future__ import annotations

import logging
import os
import xml.etree.ElementTree as ET
from decimal import Decimal

import httpx

from core.exceptions import FiscalAPIError
from travel_platform.compliance.fiscal_common import (
    FiscalProviderResult,
    build_success_result,
    compute_invoice_amounts,
    format_amount,
)
from travel_platform.compliance.fiscal_models import (
    BookingFiscalData,
    FiscalDocumentCategory,
    FiscalProvider,
    FiscalTransmissionResult,
)

logger = logging.getLogger(__name__)

MYDATA_INVOICE_NS = "http://www.aade.gr/myDATA/invoice/v1.0"
MYDATA_INCOME_NS = "https://www.aade.gr/myDATA/incomeClassificaton/v1.0"

AADE_DEV_SEND_INVOICES_URL = "https://mydataapidev.aade.gr/myDATA/SendInvoices"


def _ns(tag: str, namespace: str = MYDATA_INVOICE_NS) -> str:
    return f"{{{namespace}}}{tag}"


def _format_amount(value: Decimal) -> str:
    return format_amount(value)


def _append_income_classification(parent: ET.Element, data: BookingFiscalData, amount: Decimal) -> None:
    income_cls = ET.SubElement(parent, _ns("incomeClassification"))
    ET.SubElement(income_cls, _ns("classificationType", MYDATA_INCOME_NS)).text = (
        data.income_classification_type
    )
    ET.SubElement(income_cls, _ns("classificationCategory", MYDATA_INCOME_NS)).text = (
        data.income_classification_category
    )
    ET.SubElement(income_cls, _ns("amount", MYDATA_INCOME_NS)).text = _format_amount(amount)


class NativeAADEStrategy:
    """Build myDATA XML with ElementTree and transmit via httpx."""

    def __init__(
        self,
        *,
        api_url: str | None = None,
        timeout: float = 45.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._api_url = (
            api_url
            or os.getenv("AADE_DEV_API_URL")
            or os.getenv("AADE_API_URL")
            or AADE_DEV_SEND_INVOICES_URL
        )
        self._timeout = timeout
        self._client = client

    def build_xml_payload(self, data: BookingFiscalData) -> str:
        """Build SendInvoices XML for a single booking fiscal document."""
        amounts = compute_invoice_amounts(data.gross_amount, data.vat_rate_percent)
        if amounts.net + amounts.vat != amounts.gross:
            raise FiscalAPIError(
                "Invoice summary math failed reconciliation",
                details={
                    "net": str(amounts.net),
                    "vat": str(amounts.vat),
                    "gross": str(amounts.gross),
                },
            )

        ET.register_namespace("", MYDATA_INVOICE_NS)
        ET.register_namespace("icls", MYDATA_INCOME_NS)

        root = ET.Element(_ns("InvoicesDoc"))
        invoice = ET.SubElement(root, _ns("invoice"))

        issuer = ET.SubElement(invoice, _ns("issuer"))
        ET.SubElement(issuer, _ns("vatNumber")).text = data.issuer_vat
        ET.SubElement(issuer, _ns("country")).text = data.issuer_country
        ET.SubElement(issuer, _ns("branch")).text = str(data.issuer_branch)

        if data.document_category == FiscalDocumentCategory.INVOICE and data.counterpart_vat:
            counterpart = ET.SubElement(invoice, _ns("counterpart"))
            ET.SubElement(counterpart, _ns("vatNumber")).text = data.counterpart_vat
            ET.SubElement(counterpart, _ns("country")).text = data.counterpart_country
            if data.counterpart_name:
                ET.SubElement(counterpart, _ns("name")).text = data.counterpart_name

        header = ET.SubElement(invoice, _ns("invoiceHeader"))
        ET.SubElement(header, _ns("series")).text = data.series
        ET.SubElement(header, _ns("aa")).text = str(data.serial_number)
        ET.SubElement(header, _ns("issueDate")).text = data.issue_date.isoformat()
        ET.SubElement(header, _ns("invoiceType")).text = data.invoice_type
        ET.SubElement(header, _ns("currency")).text = data.currency

        payment_methods = ET.SubElement(invoice, _ns("paymentMethods"))
        payment_details = ET.SubElement(payment_methods, _ns("paymentMethodDetails"))
        ET.SubElement(payment_details, _ns("type")).text = str(data.payment_method_type)
        ET.SubElement(payment_details, _ns("amount")).text = _format_amount(data.resolved_payment_amount)

        line = ET.SubElement(invoice, _ns("invoiceDetails"))
        ET.SubElement(line, _ns("lineNumber")).text = str(data.line_number)
        if data.line_description:
            ET.SubElement(line, _ns("itemDescr")).text = data.line_description
        ET.SubElement(line, _ns("netValue")).text = _format_amount(amounts.net)
        ET.SubElement(line, _ns("vatCategory")).text = str(data.vat_category)
        ET.SubElement(line, _ns("vatAmount")).text = _format_amount(amounts.vat)
        _append_income_classification(line, data, amounts.net)

        summary = ET.SubElement(invoice, _ns("invoiceSummary"))
        ET.SubElement(summary, _ns("totalNetValue")).text = _format_amount(amounts.net)
        ET.SubElement(summary, _ns("totalVatAmount")).text = _format_amount(amounts.vat)
        for zero_field in (
            "totalWithheldAmount",
            "totalFeesAmount",
            "totalStampDutyAmount",
            "totalOtherTaxesAmount",
            "totalDeductionsAmount",
        ):
            ET.SubElement(summary, _ns(zero_field)).text = "0.00"
        ET.SubElement(summary, _ns("totalGrossValue")).text = _format_amount(amounts.gross)
        _append_income_classification(summary, data, amounts.net)

        xml_body = ET.tostring(root, encoding="unicode")
        return f'<?xml version="1.0" encoding="UTF-8"?>{xml_body}'

    @staticmethod
    def _local_name(tag: str) -> str:
        return tag.rsplit("}", 1)[-1]

    @classmethod
    def parse_response_xml(cls, xml_text: str) -> FiscalTransmissionResult:
        """Parse myDATA ResponseDoc XML into mark/uid or raise FiscalAPIError."""
        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError as exc:
            raise FiscalAPIError(f"Invalid AADE response XML: {exc}") from exc

        response_nodes = [node for node in root.iter() if cls._local_name(node.tag) == "response"]
        if not response_nodes:
            raise FiscalAPIError("AADE response missing <response> element")

        response = response_nodes[0]
        status_code = cls._first_text(response, "statusCode") or "Unknown"
        invoice_mark = cls._first_text(response, "invoiceMark")
        invoice_uid = cls._first_text(response, "invoiceUid")

        if status_code.lower() == "success" and invoice_mark and invoice_uid:
            return FiscalTransmissionResult(
                invoice_mark=invoice_mark,
                invoice_uid=invoice_uid,
                status_code=status_code,
            )

        error_message = cls._extract_error_message(response) or cls._extract_error_message(root)
        if not error_message:
            error_message = f"AADE transmission failed with status {status_code}"

        raise FiscalAPIError(
            error_message,
            details={
                "status_code": status_code,
                "invoice_mark": invoice_mark,
                "invoice_uid": invoice_uid,
            },
        )

    @classmethod
    def _first_text(cls, parent: ET.Element, local_name: str) -> str | None:
        for child in parent.iter():
            if cls._local_name(child.tag) == local_name and child.text:
                return child.text.strip()
        return None

    @classmethod
    def _extract_error_message(cls, node: ET.Element) -> str | None:
        for child in node.iter():
            if cls._local_name(child.tag) == "message" and child.text:
                text = child.text.strip()
                if text:
                    return text
        return None

    async def transmit(
        self,
        data: BookingFiscalData,
        credentials: dict[str, str],
    ) -> FiscalTransmissionResult:
        """Build XML, POST to AADE, parse and return invoice mark/uid."""
        xml_payload = self.build_xml_payload(data)
        response_text = await self._post_xml(xml_payload, credentials)
        return self.parse_response_xml(response_text)

    async def transmit_unified(
        self,
        data: BookingFiscalData,
        credentials: dict[str, str],
    ) -> FiscalProviderResult:
        result = await self.transmit(data, credentials)
        return build_success_result(
            provider=FiscalProvider.NATIVE_AADE.value,
            mark=result.invoice_mark,
            uid=result.invoice_uid,
            document_id=result.invoice_uid,
            raw={"status_code": result.status_code},
        )

    async def _post_xml(self, xml_payload: str, credentials: dict[str, str]) -> str:
        headers = {
            "Content-Type": "application/xml",
            "Accept": "application/xml",
            "aade-user-id": credentials.get("aade_user_id", ""),
            "Ocp-Apim-Subscription-Key": credentials.get("aade_subscription_key", ""),
        }

        if not headers["aade-user-id"] or not headers["Ocp-Apim-Subscription-Key"]:
            raise FiscalAPIError("Missing AADE credentials (aade_user_id / aade_subscription_key)")

        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=self._timeout)

        try:
            logger.info("AADE SendInvoices → %s (%d bytes)", self._api_url, len(xml_payload))
            response = await client.post(self._api_url, content=xml_payload, headers=headers)
            response.raise_for_status()
            return response.text
        except httpx.HTTPStatusError as exc:
            body = exc.response.text if exc.response is not None else ""
            if body.lstrip().startswith("<"):
                self.parse_response_xml(body)
            raise FiscalAPIError(
                f"AADE HTTP {exc.response.status_code}: {body[:1000] or exc}",
                details={"status_code": exc.response.status_code},
            ) from exc
        except httpx.HTTPError as exc:
            raise FiscalAPIError(f"AADE HTTP client error: {exc}") from exc
        finally:
            if owns_client:
                await client.aclose()
