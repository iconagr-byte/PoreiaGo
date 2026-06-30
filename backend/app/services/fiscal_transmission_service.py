"""Transmit fiscal invoices via tenant-configured provider (AADE / Prosvasis / Epsilon)."""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.aade import AadeSubmission, AadeSubmissionStatus
from app.models.booking import Booking, PaymentStatus
from app.models.fiscal_invoice import FiscalInvoice, FiscalInvoiceKind, FiscalInvoiceStatus
from app.models.tenant import Tenant
from app.services.aade_queue_service import AadeQueueService
from app.services.fiscal_invoice_service import VAT_RATE, build_line_description
from core.exceptions import FiscalAPIError
from travel_platform.compliance.fiscal_models import (
    BookingFiscalData,
    FiscalDocumentCategory,
    PlatformPaymentMethod,
)
from travel_platform.compliance.fiscal_factory import FiscalFactory

logger = logging.getLogger(__name__)


def _parse_settings(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def infer_platform_payment_method(booking: Booking, payload: dict[str, Any]) -> PlatformPaymentMethod:
    meta = booking.metadata_json if isinstance(booking.metadata_json, dict) else {}
    raw = str(
        meta.get("payment_method")
        or meta.get("paymentMethod")
        or payload.get("payment_method")
        or "",
    ).lower()
    if any(token in raw for token in ("card", "κάρτα", "credit", "stripe")):
        return PlatformPaymentMethod.CREDIT_CARD
    if "paypal" in raw:
        return PlatformPaymentMethod.PAYPAL
    if any(token in raw for token in ("τραπεζ", "bank", "transfer", "έμβασμα")):
        return PlatformPaymentMethod.BANK_TRANSFER
    if any(token in raw for token in ("eshop", "online")):
        return PlatformPaymentMethod.ESHOP
    if any(token in raw for token in ("πιστώ", "credit terms")):
        return PlatformPaymentMethod.ON_CREDIT
    return PlatformPaymentMethod.CASH


def resolve_issuer_vat(settings_json: str | None) -> str:
    fiscal = _parse_settings(settings_json).get("fiscal")
    if isinstance(fiscal, dict) and fiscal.get("issuer_vat"):
        return str(fiscal["issuer_vat"])
    return os.getenv("AADE_VAT_NUMBER", "000000000")


def resolve_document_series(settings_json: str | None, *, document_category: FiscalDocumentCategory) -> str:
    fiscal = _parse_settings(settings_json).get("fiscal")
    if isinstance(fiscal, dict):
        if document_category == FiscalDocumentCategory.CREDIT_NOTE_INVOICE:
            return str(fiscal.get("series_credit_invoice") or fiscal.get("series_invoice") or "ΠΛΤ")
        if document_category == FiscalDocumentCategory.CREDIT_NOTE_RETAIL:
            return str(fiscal.get("series_credit_retail") or fiscal.get("series_retail") or "ΠΛΣ")
        if document_category == FiscalDocumentCategory.INVOICE and fiscal.get("series_invoice"):
            return str(fiscal["series_invoice"])
        if fiscal.get("series_retail"):
            return str(fiscal["series_retail"])
        if fiscal.get("series"):
            return str(fiscal["series"])
    if document_category == FiscalDocumentCategory.CREDIT_NOTE_INVOICE:
        return "ΠΛΤ"
    if document_category == FiscalDocumentCategory.CREDIT_NOTE_RETAIL:
        return "ΠΛΣ"
    return "ΑΠΥ" if document_category == FiscalDocumentCategory.RETAIL_RECEIPT else "ΤΠΥ"


def resolve_credit_document_category(
    *,
    booking: Booking,
    original_payload: dict[str, Any] | None,
) -> FiscalDocumentCategory:
    payload = original_payload if isinstance(original_payload, dict) else {}
    if payload.get("document_type") == "invoice" or booking.passenger_vat_id:
        return FiscalDocumentCategory.CREDIT_NOTE_INVOICE
    if payload.get("document_category") == FiscalDocumentCategory.INVOICE.value:
        return FiscalDocumentCategory.CREDIT_NOTE_INVOICE
    return FiscalDocumentCategory.CREDIT_NOTE_RETAIL


def stable_serial_number(invoice_id: UUID) -> int:
    return abs(hash(str(invoice_id))) % 999_999 + 1


def build_booking_fiscal_data(
    *,
    booking: Booking,
    invoice: FiscalInvoice,
    payload: dict[str, Any],
    tenant_settings_json: str | None,
) -> BookingFiscalData:
    invoice_meta = invoice.metadata_json if isinstance(invoice.metadata_json, dict) else {}
    if invoice.invoice_kind == FiscalInvoiceKind.CREDIT_NOTE:
        document_category = resolve_credit_document_category(
            booking=booking,
            original_payload=invoice_meta.get("original_aade_payload"),
        )
    else:
        document_category = (
            FiscalDocumentCategory.INVOICE
            if booking.passenger_vat_id
            else FiscalDocumentCategory.RETAIL_RECEIPT
        )
    trip_title = (booking.metadata_json or {}).get("trip_title") if booking.metadata_json else None
    meta = booking.metadata_json if isinstance(booking.metadata_json, dict) else {}
    description = build_line_description(
        invoice.invoice_kind,
        trip_title,
        booking.reference_code,
        credited_mark=str(invoice_meta.get("credited_mark") or "") or None,
    )

    return BookingFiscalData(
        issuer_vat=resolve_issuer_vat(tenant_settings_json),
        series=resolve_document_series(tenant_settings_json, document_category=document_category),
        serial_number=int(payload.get("serial_number") or stable_serial_number(invoice.id)),
        issue_date=date.today(),
        document_category=document_category,
        gross_amount=Decimal(str(invoice.amount)),
        vat_rate_percent=Decimal(str(payload.get("vat_rate", VAT_RATE))),
        line_description=description,
        payment_method=infer_platform_payment_method(booking, payload),
        booking_reference=booking.reference_code,
        counterpart_vat=booking.passenger_vat_id,
        counterpart_name=booking.passenger_name if document_category == FiscalDocumentCategory.INVOICE else None,
        customer_name=booking.passenger_name,
        customer_email=booking.passenger_email,
        service_item_code=meta.get("service_item_code"),
    )


async def load_native_aade_credentials(tenant_id: UUID) -> dict[str, str]:
    from travel_platform.compliance.aade_gateway import EnvSecretsProvider

    creds = await EnvSecretsProvider().get_tenant_aade_credentials(str(tenant_id))
    return {
        "aade_user_id": creds.get("aade_user_id", ""),
        "aade_subscription_key": creds.get("aade_subscription_key", ""),
    }


async def apply_transmission_result(
    session: AsyncSession,
    *,
    submission_id: UUID,
    result: dict[str, Any],
) -> None:
    invoice_row = await session.execute(
        select(FiscalInvoice, Booking)
        .join(Booking, Booking.id == FiscalInvoice.booking_id)
        .where(FiscalInvoice.aade_submission_id == submission_id),
    )
    row = invoice_row.one_or_none()
    if not row:
        await session.flush()
        return

    invoice, booking = row
    mark = str(result.get("mark") or "")
    invoice.status = FiscalInvoiceStatus.ISSUED
    invoice.aade_mark = mark
    invoice.error_message = None
    invoice.metadata_json = {
        **(invoice.metadata_json or {}),
        "fiscal_provider": result.get("provider"),
        "fiscal_document_id": result.get("document_id"),
        "fiscal_transmission": result,
    }

    if booking.payment_status == PaymentStatus.PAID or mark:
        booking.fiscal_mark = mark or booking.fiscal_mark

    await session.flush()
    logger.info(
        "Fiscal transmitted submission=%s provider=%s mark=%s invoice=%s",
        submission_id,
        result.get("provider"),
        mark,
        invoice.id,
    )


class FiscalTransmissionService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._queue = AadeQueueService(session)

    async def transmit_submission(self, submission_id: UUID) -> dict[str, Any]:
        submission_row = await self._session.execute(
            select(AadeSubmission).where(AadeSubmission.id == submission_id),
        )
        submission = submission_row.scalar_one_or_none()
        if not submission:
            raise FiscalAPIError(f"AadeSubmission not found: {submission_id}")

        if submission.status == AadeSubmissionStatus.ACCEPTED and submission.mark:
            return {
                "success": True,
                "mark": submission.mark,
                "uid": submission.aade_uid or submission.mark,
                "provider": (submission.payload_json or {}).get("provider", "cached"),
                "cached": True,
            }

        booking_row = await self._session.execute(
            select(Booking).where(Booking.id == submission.booking_id),
        )
        booking = booking_row.scalar_one_or_none()
        if not booking:
            raise FiscalAPIError(f"Booking not found for submission {submission_id}")

        invoice_row = await self._session.execute(
            select(FiscalInvoice).where(FiscalInvoice.aade_submission_id == submission_id),
        )
        invoice = invoice_row.scalar_one_or_none()

        tenant_row = await self._session.execute(
            select(Tenant).where(Tenant.id == submission.tenant_id),
        )
        tenant = tenant_row.scalar_one_or_none()
        tenant_settings = tenant.settings_json if tenant else None

        payload = submission.payload_json if isinstance(submission.payload_json, dict) else {}
        if not invoice:
            fiscal_data = BookingFiscalData(
                issuer_vat=resolve_issuer_vat(tenant_settings),
                series=resolve_document_series(tenant_settings, document_category=FiscalDocumentCategory.RETAIL_RECEIPT),
                serial_number=stable_serial_number(submission.id),
                issue_date=date.today(),
                document_category=FiscalDocumentCategory.RETAIL_RECEIPT,
                gross_amount=Decimal(str(payload.get("amount_eur", 0))),
                vat_rate_percent=Decimal(str(payload.get("vat_rate", VAT_RATE))),
                line_description=(payload.get("line_items") or [{}])[0].get("description", "Booking"),
                booking_reference=payload.get("booking_reference") or str(booking.reference_code),
                customer_name=booking.passenger_name,
                customer_email=booking.passenger_email,
            )
        else:
            fiscal_data = build_booking_fiscal_data(
                booking=booking,
                invoice=invoice,
                payload=payload,
                tenant_settings_json=tenant_settings,
            )

        await self._queue.mark_processing(submission_id)
        native_credentials = await load_native_aade_credentials(submission.tenant_id)
        factory = FiscalFactory.from_tenant_settings(
            tenant_settings,
            native_credentials=native_credentials,
        )
        provider_name = factory.provider.value
        started = time.perf_counter()
        result = await factory.issue_invoice(fiscal_data)
        try:
            from app.observability.fiscal_metrics import record_provider_call

            record_provider_call(
                provider=provider_name,
                duration_seconds=time.perf_counter() - started,
                success=bool(result.get("success")),
            )
        except Exception:
            logger.debug("Fiscal provider metrics skipped", exc_info=True)

        if not result.get("success"):
            raise FiscalAPIError("Fiscal provider returned unsuccessful result", details=result)

        await apply_transmission_result(self._session, submission_id=submission_id, result=result)
        await self._queue.mark_accepted(submission_id, mark=result["mark"], aade_uid=result["uid"])
        return result
