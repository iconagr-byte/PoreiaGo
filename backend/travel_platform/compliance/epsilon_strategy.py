"""
Epsilon Smart fiscal adapter — e-Shop InsertDocuments API.

Uses Bearer JWT auth and maps platform VAT categories / payment methods to
Epsilon Smart integer codes.
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
    format_amount_float,
)
from travel_platform.compliance.fiscal_mappings import (
    map_payment_to_epsilon,
    map_vat_category_to_epsilon_status,
)
from travel_platform.compliance.fiscal_models import (
    BookingFiscalData,
    FiscalDocumentCategory,
    FiscalProvider,
)
from travel_platform.compliance.fiscal_tenant_config import EpsilonTenantConfig

logger = logging.getLogger(__name__)

EPSILON_INSERT_DOCUMENTS_PATH = "api/Eshop/InsertDocuments"


class EpsilonStrategy:
    def __init__(
        self,
        *,
        timeout: float = 45.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._timeout = timeout
        self._client = client

    def build_json_payload(
        self,
        data: BookingFiscalData,
        config: EpsilonTenantConfig,
    ) -> list[dict[str, Any]]:
        amounts = compute_invoice_amounts(data.gross_amount, data.vat_rate_percent)
        is_retail = data.document_category == FiscalDocumentCategory.RETAIL_RECEIPT
        payment_method = map_payment_to_epsilon(data.resolved_payment_method)
        vat_status = map_vat_category_to_epsilon_status(data.vat_category)
        item_code = (
            (config.retail_item_code if is_retail else config.wholesale_item_code)
            or data.service_item_code
            or "TRAVEL-TICKET"
        )
        ref_code = data.booking_reference or f"{data.series}-{data.serial_number}"
        doc_dt = datetime.combine(data.issue_date, datetime.min.time()).strftime("%Y-%m-%dT%H:%M:%S.000")

        line: dict[str, Any] = {
            "ItemCode": item_code,
            "VATPercent": float(data.vat_rate_percent),
            "Qty": 1,
            "VATVal": format_amount_float(amounts.vat),
        }
        if is_retail:
            line["Price"] = format_amount_float(amounts.gross)
            line["TotalVal"] = format_amount_float(amounts.gross)
        else:
            line["Price"] = format_amount_float(amounts.net)
            line["NetVal"] = format_amount_float(amounts.net)

        document: dict[str, Any] = {
            "DocDateTime": doc_dt,
            "IsRetail": 1 if is_retail else 0,
            "VatStatus": vat_status,
            "RefDocCode": ref_code,
            "PaymentMethod": payment_method,
            "Justification": data.line_description or "Booking Travel ticket",
            "Lines": [line],
        }

        if data.customer_name:
            document["CustName"] = data.customer_name
        elif not is_retail:
            document["CustName"] = data.counterpart_name or "Booking customer"
        else:
            document["CustName"] = data.counterpart_name or "Λιανική πώληση"

        if data.counterpart_vat:
            document["CustTIN"] = data.counterpart_vat
        if data.customer_email:
            document["CustEmail"] = data.customer_email
        if data.customer_phone:
            document["CustPhone1"] = data.customer_phone

        return [document]

    @classmethod
    def parse_response_json(cls, payload: Any, *, ref_doc_code: str) -> FiscalProviderResult:
        relations: list[dict[str, Any]]
        if isinstance(payload, list):
            relations = [item for item in payload if isinstance(item, dict)]
        elif isinstance(payload, dict):
            api_result = payload.get("ApiResult")
            if isinstance(api_result, list):
                relations = [item for item in api_result if isinstance(item, dict)]
            else:
                relations = [payload]
        else:
            raise FiscalAPIError("Epsilon Smart returned an unexpected response type")

        matched = next(
            (rel for rel in relations if str(rel.get("RefDocCode") or "") == ref_doc_code),
            relations[0] if relations else None,
        )
        if not matched:
            raise FiscalAPIError("Epsilon Smart response missing document relation")

        error_message = matched.get("ErrorMessage")
        if error_message:
            raise FiscalAPIError(str(error_message), details={"provider": FiscalProvider.EPSILON.value})

        smart_doc_id = str(
            matched.get("SmartDocId")
            or matched.get("smartDocId")
            or deep_find_first(matched, {"SmartDocId", "DocumentId", "id"})
            or "",
        )
        mark = (
            deep_find_first(matched, {"Mark", "mark", "MyDataMark", "myDataMark", "AadeMark"})
            or deep_find_first(payload if isinstance(payload, dict) else matched, {"Mark", "mark"})
            or smart_doc_id
        )
        if not smart_doc_id and not mark:
            raise FiscalAPIError("Epsilon Smart response missing SmartDocId / MARK")

        return build_success_result(
            provider=FiscalProvider.EPSILON.value,
            mark=str(mark),
            uid=smart_doc_id or str(mark),
            document_id=smart_doc_id or str(mark),
            raw=matched if isinstance(matched, dict) else {"relations": relations},
        )

    async def transmit(
        self,
        data: BookingFiscalData,
        config: EpsilonTenantConfig,
    ) -> FiscalProviderResult:
        if not config.bearer_token:
            raise FiscalAPIError("Epsilon Smart JWT bearer token missing")

        documents = self.build_json_payload(data, config)
        ref_code = documents[0]["RefDocCode"]
        base = config.smart_url.rstrip("/") + "/"
        url = f"{base}{EPSILON_INSERT_DOCUMENTS_PATH}"
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {config.bearer_token}",
        }
        if config.subscription_key:
            headers["X-Subscription-Key"] = config.subscription_key

        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=self._timeout)
        try:
            logger.info("Epsilon Smart InsertDocuments → %s ref=%s", url, ref_code)
            response = await client.post(url, json=documents, headers=headers)
            if response.status_code >= 400:
                try:
                    problem = response.json()
                except ValueError:
                    problem = {"detail": response.text[:1000]}
                api_result = problem.get("ApiResult") if isinstance(problem, dict) else None
                if isinstance(api_result, list) and api_result:
                    return self.parse_response_json(problem, ref_doc_code=ref_code)
                detail = problem.get("detail") or problem.get("title") or response.text[:1000]
                raise FiscalAPIError(
                    f"Epsilon Smart HTTP {response.status_code}: {detail}",
                    details={"status_code": response.status_code},
                )
            payload = response.json()
            return self.parse_response_json(payload, ref_doc_code=ref_code)
        except FiscalAPIError:
            raise
        except httpx.HTTPError as exc:
            raise FiscalAPIError(f"Epsilon Smart HTTP client error: {exc}") from exc
        finally:
            if owns_client:
                await client.aclose()
