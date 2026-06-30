"""
Prosvasis GO fiscal adapter — JSON payload + Bearer auth.

Maps BookingFiscalData to Prosvasis GO /s1services/set/saldoc and returns the
provider document id plus the AADE MARK when present in the response payload.
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
    deep_find_first,
    format_amount,
    format_amount_float,
)
from travel_platform.compliance.fiscal_mappings import (
    DEFAULT_PROSVASIS_VAT_PROVISIONS,
    DEFAULT_PROSVASIS_VAT_STATUS,
    map_payment_to_prosvasis,
    map_vat_category_to_prosvasis_vat_id,
)
from travel_platform.compliance.fiscal_models import (
    BookingFiscalData,
    FiscalDocumentCategory,
    FiscalProvider,
)
from travel_platform.compliance.fiscal_tenant_config import ProsvasisTenantConfig

logger = logging.getLogger(__name__)

PROSVASIS_SET_SALDOC_PATH = "/s1services/set/saldoc"
PROSVASIS_LOCATEINFO = (
    "SALDOC:FINDOC,CMPFINCODE,FINCODE,NETAMNT,VATAMNT,SUMAMNT,TRNDATE,SERIES;"
    "SRVLINES:LINENUM,LINEVAL,PRICE,QTY1;"
    "VATANAL:LINENUM,SUBVAL,VATVAL"
)


class ProsvasisStrategy:
    def __init__(
        self,
        *,
        api_url: str | None = None,
        timeout: float = 45.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._api_url = (api_url or "https://go.s1cloud.net").rstrip("/")
        self._timeout = timeout
        self._client = client

    def build_json_payload(
        self,
        data: BookingFiscalData,
        config: ProsvasisTenantConfig,
    ) -> dict[str, Any]:
        amounts = compute_invoice_amounts(data.gross_amount, data.vat_rate_percent)
        is_retail = data.document_category == FiscalDocumentCategory.RETAIL_RECEIPT
        series = config.series_retail if is_retail else config.series_invoice
        payment_code = map_payment_to_prosvasis(
            data.resolved_payment_method,
            config.payment_codes,
        )
        vat_id = map_vat_category_to_prosvasis_vat_id(data.vat_category, data.vat_rate_percent)
        issue_dt = datetime.combine(data.issue_date, datetime.min.time()).strftime("%Y-%m-%d %H:%M:%S")
        remarks = data.line_description or data.booking_reference or "Booking Travel"

        saldoc: dict[str, Any] = {
            "SERIES": series,
            "BRANCH": config.branch,
            "TRNDATE": issue_dt,
            "TRDR": config.default_trdr,
            "PAYMENT": payment_code,
            "VATPROVISIONS": DEFAULT_PROSVASIS_VAT_PROVISIONS,
            "VATSTS": DEFAULT_PROSVASIS_VAT_STATUS,
            "NETAMNT": format_amount(amounts.net),
            "VATAMNT": format_amount(amounts.vat),
            "SUMAMNT": format_amount(amounts.gross),
            "REMARKS": remarks,
            "SHIPMENT": 1,
            "SHIPKIND": 200,
        }
        if data.booking_reference:
            saldoc["CMPFINCODE"] = data.booking_reference
        if data.counterpart_vat:
            saldoc["TRDR_CUSTOMER_AFM"] = data.counterpart_vat
        if data.counterpart_name:
            saldoc["TRDR_CUSTOMER_NAME"] = data.counterpart_name

        srvline: dict[str, Any] = {
            "LINENUM": data.line_number,
            "COMMENTS": data.line_description or remarks,
            "QTY1": 1,
            "PRICE": format_amount_float(amounts.net),
            "LINEVAL": format_amount_float(amounts.gross),
            "VAT": vat_id,
        }
        if config.service_mtrl_code or data.service_item_code:
            srvline["MTRL_SERVICE_CODE"] = data.service_item_code or config.service_mtrl_code

        return {
            "data": {
                "SALDOC": [saldoc],
                "SRVLINES": [srvline],
                "VATANAL": [
                    {
                        "LINENUM": 1,
                        "VAT": vat_id,
                        "SUBVAL": format_amount_float(amounts.net),
                        "VATVAL": format_amount_float(amounts.vat),
                        "VAT_VAT_PERCNT": float(data.vat_rate_percent),
                    },
                ],
            },
            "appId": config.app_id,
            "locateinfo": PROSVASIS_LOCATEINFO,
            "key": "",
            "token": config.bearer_token,
        }

    @classmethod
    def parse_response_json(cls, payload: dict[str, Any]) -> FiscalProviderResult:
        if not payload.get("success"):
            message = (
                payload.get("error")
                or payload.get("message")
                or payload.get("caption")
                or "Prosvasis GO rejected the sales document"
            )
            raise FiscalAPIError(str(message), details={"provider": FiscalProvider.PROSVASIS.value})

        document_id = str(payload.get("id") or "")
        mark = (
            deep_find_first(payload, {"MARK", "mark", "MYDATAMARK", "myDataMark", "AADEMARK"})
            or deep_find_first(payload.get("data"), {"CMPFINCODE", "FINCODE"})
            or document_id
        )
        uid = (
            deep_find_first(payload, {"invoiceUid", "UID", "uid", "FINDOC"})
            or document_id
        )
        if not document_id and not mark:
            raise FiscalAPIError("Prosvasis GO response missing document id / MARK")

        return build_success_result(
            provider=FiscalProvider.PROSVASIS.value,
            mark=str(mark),
            uid=str(uid or mark),
            document_id=document_id or str(mark),
            raw=payload,
        )

    async def transmit(
        self,
        data: BookingFiscalData,
        config: ProsvasisTenantConfig,
    ) -> FiscalProviderResult:
        if not config.bearer_token or not config.app_id or not config.s1code:
            raise FiscalAPIError("Prosvasis GO credentials incomplete (app_id / s1code / bearer_token)")

        body = self.build_json_payload(data, config)
        url = f"{self._api_url}{PROSVASIS_SET_SALDOC_PATH}"
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {config.bearer_token}",
            "s1code": config.s1code,
        }

        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=self._timeout)
        try:
            logger.info("Prosvasis GO set/saldoc → %s ref=%s", url, data.booking_reference)
            response = await client.post(url, json=body, headers=headers)
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                raise FiscalAPIError("Prosvasis GO returned a non-object JSON response")
            return self.parse_response_json(payload)
        except FiscalAPIError:
            raise
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text[:1000] if exc.response is not None else str(exc)
            raise FiscalAPIError(
                f"Prosvasis GO HTTP {exc.response.status_code}: {detail}",
                details={"status_code": exc.response.status_code},
            ) from exc
        except httpx.HTTPError as exc:
            raise FiscalAPIError(f"Prosvasis GO HTTP client error: {exc}") from exc
        finally:
            if owns_client:
                await client.aclose()
