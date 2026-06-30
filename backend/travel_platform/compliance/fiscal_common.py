"""Shared helpers for fiscal provider strategies."""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any, TypedDict

from travel_platform.compliance.fiscal_models import InvoiceAmounts

_TWO_DP = Decimal("0.01")


class FiscalProviderResult(TypedDict, total=False):
    success: bool
    mark: str
    uid: str
    provider: str
    document_id: str
    raw: dict[str, Any]


def format_amount(value: Decimal) -> str:
    return f"{value.quantize(_TWO_DP, rounding=ROUND_HALF_UP):.2f}"


def format_amount_float(value: Decimal) -> float:
    return float(format_amount(value))


def compute_invoice_amounts(gross: Decimal, vat_rate_percent: Decimal) -> InvoiceAmounts:
    gross_q = gross.quantize(_TWO_DP, rounding=ROUND_HALF_UP)
    if gross_q <= 0:
        raise ValueError("gross amount must be positive")

    rate = vat_rate_percent / Decimal("100")
    divisor = Decimal("1") + rate
    net = (gross_q / divisor).quantize(_TWO_DP, rounding=ROUND_HALF_UP)
    vat = (gross_q - net).quantize(_TWO_DP, rounding=ROUND_HALF_UP)
    return InvoiceAmounts(net=net, vat=vat, gross=net + vat)


def build_success_result(
    *,
    provider: str,
    mark: str,
    uid: str,
    document_id: str | None = None,
    raw: dict[str, Any] | None = None,
) -> FiscalProviderResult:
    return FiscalProviderResult(
        success=True,
        mark=str(mark),
        uid=str(uid),
        provider=provider,
        document_id=str(document_id or uid),
        raw=raw or {},
    )


def extract_nested_value(payload: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = payload.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return None


def deep_find_first(payload: Any, names: set[str]) -> str | None:
    if isinstance(payload, dict):
        for key, value in payload.items():
            if key in names and value is not None and str(value).strip():
                return str(value).strip()
            found = deep_find_first(value, names)
            if found:
                return found
    elif isinstance(payload, list):
        for item in payload:
            found = deep_find_first(item, names)
            if found:
                return found
    return None
