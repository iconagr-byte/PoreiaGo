"""Pydantic models for myDATA fiscal transmission."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class FiscalProvider(str, Enum):
    NATIVE_AADE = "native_aade"
    PROSVASIS = "prosvasis"
    EPSILON = "epsilon"


class PlatformPaymentMethod(str, Enum):
    """Normalized payment methods used by the booking platform."""

    CASH = "cash"
    CREDIT_CARD = "credit_card"
    BANK_TRANSFER = "bank_transfer"
    PAYPAL = "paypal"
    ON_CREDIT = "on_credit"
    ESHOP = "eshop"


class FiscalDocumentCategory(str, Enum):
    """High-level document kinds mapped to myDATA invoiceType codes."""

    RETAIL_RECEIPT = "retail_receipt"  # Απόδειξη λιανικής → 11.2
    INVOICE = "invoice"  # Τιμολόγιο παροχής υπηρεσιών → 2.1
    CREDIT_NOTE_RETAIL = "credit_note_retail"  # Πιστωτικό λιανικής → 11.4
    CREDIT_NOTE_INVOICE = "credit_note_invoice"  # Πιστωτικό τιμολόγιο → 5.2


INVOICE_TYPE_BY_CATEGORY: dict[FiscalDocumentCategory, str] = {
    FiscalDocumentCategory.RETAIL_RECEIPT: "11.2",
    FiscalDocumentCategory.INVOICE: "2.1",
    FiscalDocumentCategory.CREDIT_NOTE_RETAIL: "11.4",
    FiscalDocumentCategory.CREDIT_NOTE_INVOICE: "5.2",
}


class BookingFiscalData(BaseModel):
    """Normalized booking fiscal payload for NativeAADEStrategy XML builder."""

    model_config = ConfigDict(frozen=True, str_strip_whitespace=True)

    issuer_vat: str = Field(..., min_length=9, max_length=9, description="Issuer ΑΦΜ")
    issuer_branch: int = Field(default=0, ge=0)
    issuer_country: str = Field(default="GR", min_length=2, max_length=2)

    series: str = Field(..., min_length=1, max_length=50)
    serial_number: int = Field(..., ge=1, description="invoiceHeader.aa")
    issue_date: date
    document_category: FiscalDocumentCategory

    currency: str = Field(default="EUR", min_length=3, max_length=3)
    gross_amount: Decimal = Field(..., gt=0, description="Tax-inclusive line total")
    vat_rate_percent: Decimal = Field(default=Decimal("24"), ge=0, le=100)
    vat_category: int = Field(default=1, ge=1, le=8, description="1 = 24% standard VAT")

    line_number: int = Field(default=1, ge=1)
    line_description: str = Field(default="")

    payment_method_type: int = Field(default=3, ge=1, description="3=cash, 5=card")
    payment_method: PlatformPaymentMethod | None = None
    payment_amount: Decimal | None = None

    service_item_code: str | None = Field(default=None, description="ERP item/service code")
    customer_name: str | None = None
    customer_email: str | None = None
    customer_phone: str | None = None

    counterpart_vat: str | None = Field(default=None, min_length=9, max_length=9)
    counterpart_country: str = Field(default="GR", min_length=2, max_length=2)
    counterpart_name: str | None = None

    booking_reference: str | None = None
    income_classification_type: str = Field(default="E3_561_003")
    income_classification_category: str = Field(default="category1_1")

    @field_validator("gross_amount", "payment_amount", mode="before")
    @classmethod
    def _coerce_decimal(cls, value: object) -> object:
        if value is None:
            return value
        return Decimal(str(value))

    @property
    def invoice_type(self) -> str:
        return INVOICE_TYPE_BY_CATEGORY[self.document_category]

    @property
    def resolved_payment_amount(self) -> Decimal:
        return self.payment_amount or self.gross_amount

    @property
    def resolved_payment_method(self) -> PlatformPaymentMethod:
        if self.payment_method:
            return self.payment_method
        if self.payment_method_type == 5:
            return PlatformPaymentMethod.CREDIT_CARD
        if self.payment_method_type == 1:
            return PlatformPaymentMethod.BANK_TRANSFER
        if self.payment_method_type == 7:
            return PlatformPaymentMethod.ESHOP
        return PlatformPaymentMethod.CASH


class InvoiceAmounts(BaseModel):
    """Rounded myDATA line + summary amounts with net + vat = gross."""

    model_config = ConfigDict(frozen=True)

    net: Decimal
    vat: Decimal
    gross: Decimal


class FiscalTransmissionResult(BaseModel):
    """Successful myDATA SendInvoices response."""

    model_config = ConfigDict(frozen=True)

    invoice_mark: str
    invoice_uid: str
    status_code: str = "Success"
