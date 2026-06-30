"""
Fiscal invoice issuance — per-transaction AADE receipts (deposit / settlement).
"""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, PaymentStatus
from app.models.fiscal_invoice import FiscalInvoice, FiscalInvoiceKind, FiscalInvoiceStatus
from app.services.aade_queue_service import AadeQueueService

logger = logging.getLogger(__name__)

VAT_RATE = 24.0
DOCUMENT_RECEIPT = "receipt"


def resolve_invoice_kind(*, previous_paid: Decimal, new_paid: Decimal, total_price: Decimal) -> FiscalInvoiceKind:
    """
    Classify the fiscal receipt for the amount just charged.

    - First payment with remaining balance → DOWN_PAYMENT
    - First payment covering full total in one transaction → FULL_PAYMENT
    - Payment that clears balance after a prior partial → FINAL_SETTLEMENT
    """
    if new_paid >= total_price:
        return FiscalInvoiceKind.FINAL_SETTLEMENT if previous_paid > 0 else FiscalInvoiceKind.FULL_PAYMENT
    return FiscalInvoiceKind.DOWN_PAYMENT


def build_line_description(
    kind: FiscalInvoiceKind,
    trip_title: str | None,
    reference_code: str,
    *,
    credited_mark: str | None = None,
) -> str:
    base = trip_title or "Εισιτήριο εκδρομής"
    if kind == FiscalInvoiceKind.CREDIT_NOTE:
        mark_part = f" · MARK {credited_mark}" if credited_mark else ""
        return f"Πιστωτικό — {base} ({reference_code}){mark_part}"
    if kind == FiscalInvoiceKind.DOWN_PAYMENT:
        return f"Προκαταβολή — {base} ({reference_code})"
    if kind == FiscalInvoiceKind.FINAL_SETTLEMENT:
        return f"Εξόφληση υπολοίπου — {base} ({reference_code})"
    return f"{base} ({reference_code})"


class FiscalInvoiceService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def build_aade_payload(
        self,
        *,
        booking: Booking,
        invoice: FiscalInvoice,
    ) -> dict[str, Any]:
        vat_base = float(invoice.amount) / (1 + VAT_RATE / 100)
        trip_title = (booking.metadata_json or {}).get("trip_title")
        meta = invoice.metadata_json if isinstance(invoice.metadata_json, dict) else {}
        credited_mark = meta.get("credited_mark")
        description = build_line_description(
            invoice.invoice_kind,
            trip_title,
            booking.reference_code,
            credited_mark=str(credited_mark) if credited_mark else None,
        )
        is_down_payment = invoice.invoice_kind == FiscalInvoiceKind.DOWN_PAYMENT
        balance_remaining = max(float(booking.total_price - booking.amount_paid), 0.0)
        document_type = "credit_note" if invoice.invoice_kind == FiscalInvoiceKind.CREDIT_NOTE else DOCUMENT_RECEIPT

        return {
            "document_type": document_type,
            "amount_eur": float(invoice.amount),
            "vat_rate": VAT_RATE,
            "customer_country": "GR",
            "is_down_payment": is_down_payment,
            "balance_remaining_eur": balance_remaining if is_down_payment else 0.0,
            "booking_reference": booking.reference_code,
            "fiscal_invoice_id": str(invoice.id),
            "invoice_kind": invoice.invoice_kind.value,
            "credited_invoice_id": meta.get("credited_invoice_id"),
            "credited_mark": credited_mark,
            "document_category": meta.get("document_category"),
            "line_items": [
                {
                    "description": description,
                    "amount": round(vat_base, 2),
                }
            ],
        }

    async def issue_to_aade(self, fiscal_invoice_id: UUID) -> FiscalInvoice:
        """
        Enqueue myDATA transmission for a persisted FiscalInvoice.
        Called only after the payment transaction has committed.
        """
        result = await self._session.execute(
            select(FiscalInvoice, Booking)
            .join(Booking, Booking.id == FiscalInvoice.booking_id)
            .where(FiscalInvoice.id == fiscal_invoice_id),
        )
        row = result.one_or_none()
        if not row:
            raise ValueError(f"FiscalInvoice not found: {fiscal_invoice_id}")

        invoice, booking = row
        if invoice.status in (FiscalInvoiceStatus.ISSUED, FiscalInvoiceStatus.QUEUED):
            return invoice

        payload = self.build_aade_payload(booking=booking, invoice=invoice)
        queue = AadeQueueService(self._session)
        submission = await queue.enqueue_invoice(
            tenant_id=invoice.tenant_id,
            booking_id=booking.id,
            payload=payload,
            idempotency_key=invoice.idempotency_key,
        )

        invoice.aade_submission_id = submission.id
        invoice.status = FiscalInvoiceStatus.QUEUED
        invoice.metadata_json = {
            **(invoice.metadata_json or {}),
            "aade_payload": payload,
        }

        if booking.payment_status == PaymentStatus.PAID and submission.mark:
            booking.fiscal_mark = submission.mark
            invoice.aade_mark = submission.mark
            invoice.status = FiscalInvoiceStatus.ISSUED

        await self._session.flush()
        logger.info(
            "Fiscal invoice queued invoice=%s booking=%s kind=%s amount=%s",
            invoice.id,
            booking.id,
            invoice.invoice_kind.value,
            invoice.amount,
        )
        return invoice
