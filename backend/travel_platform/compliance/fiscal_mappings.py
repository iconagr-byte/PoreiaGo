"""VAT and payment method mappings for third-party fiscal providers."""

from __future__ import annotations

from travel_platform.compliance.fiscal_models import PlatformPaymentMethod

# myDATA appendix 8.12 — subset used by the booking platform
MYDATA_PAYMENT_TYPE: dict[PlatformPaymentMethod, int] = {
    PlatformPaymentMethod.CASH: 3,
    PlatformPaymentMethod.ON_CREDIT: 1,
    PlatformPaymentMethod.CREDIT_CARD: 5,
    PlatformPaymentMethod.PAYPAL: 4,
    PlatformPaymentMethod.BANK_TRANSFER: 5,
    PlatformPaymentMethod.ESHOP: 7,
}

# Epsilon Smart e-Shop API — PaymentMethod integer values
EPSILON_PAYMENT_METHOD: dict[PlatformPaymentMethod, int] = {
    PlatformPaymentMethod.CASH: 0,
    PlatformPaymentMethod.ON_CREDIT: 1,
    PlatformPaymentMethod.CREDIT_CARD: 2,
    PlatformPaymentMethod.PAYPAL: 4,
    PlatformPaymentMethod.BANK_TRANSFER: 5,
    PlatformPaymentMethod.ESHOP: 7,
}

# Prosvasis GO PAYMENT field accepts ERP payment codes (tenant-configurable defaults)
DEFAULT_PROSVASIS_PAYMENT_CODES: dict[PlatformPaymentMethod, str] = {
    PlatformPaymentMethod.CASH: "1001",
    PlatformPaymentMethod.ON_CREDIT: "200",
    PlatformPaymentMethod.CREDIT_CARD: "1003",
    PlatformPaymentMethod.PAYPAL: "1004",
    PlatformPaymentMethod.BANK_TRANSFER: "1005",
    PlatformPaymentMethod.ESHOP: "1007",
}

# myDATA VAT category (1 = 24%) → Epsilon VatStatus (0 normal, 1 reduced, 2 exempt)
EPSILON_VAT_STATUS_BY_CATEGORY: dict[int, int] = {
    1: 0,
    2: 0,
    3: 1,
    4: 1,
    5: 1,
    6: 1,
    7: 2,
    8: 2,
}

# Prosvasis VATPROVISIONS / VATSTS defaults for Greek travel receipts
DEFAULT_PROSVASIS_VAT_PROVISIONS = 1
DEFAULT_PROSVASIS_VAT_STATUS = 1


def map_payment_to_epsilon(method: PlatformPaymentMethod) -> int:
    return EPSILON_PAYMENT_METHOD[method]


def map_payment_to_prosvasis(
    method: PlatformPaymentMethod,
    overrides: dict[str, str] | None = None,
) -> str:
    if overrides and method.value in overrides:
        return str(overrides[method.value])
    return DEFAULT_PROSVASIS_PAYMENT_CODES[method]


def map_vat_category_to_epsilon_status(vat_category: int) -> int:
    return EPSILON_VAT_STATUS_BY_CATEGORY.get(vat_category, 0)


def map_vat_category_to_prosvasis_vat_id(vat_category: int, vat_rate_percent) -> int:
    """Prosvasis stores VAT as internal VAT table id — tenant may override via config."""
    if int(vat_category) == 8:
        return 0
    rate = float(vat_rate_percent)
    if rate >= 23:
        return 1410
    if rate >= 13:
        return 1411
    if rate >= 5:
        return 1412
    return 0
