"""
Booking payment capture — Stripe, cash (office/driver), with ACID + fiscal invoicing.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_deps import apply_tenant_rls
from app.models.booking import Booking, BookingStatus, PaymentStatus
from app.models.fiscal_invoice import FiscalInvoice, FiscalInvoiceStatus
from app.services.fiscal_invoice_service import FiscalInvoiceService, resolve_invoice_kind
from travel_platform.payments.cash_payment_confirm import CHANNEL_LABELS, CashPaymentChannel

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PaymentCaptureResult:
    status: str
    booking_id: UUID | None = None
    fiscal_invoice_id: UUID | None = None
    amount_captured: Decimal | None = None
    payment_status: str | None = None


class BookingPaymentService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def handle_payment_intent_succeeded(self, payment_intent: dict) -> PaymentCaptureResult:
        """
        Stripe payment_intent.succeeded handler.

        Partial payment classification (on amount_paid *before* this charge):
        - previous_paid == 0 and balance remains → DOWN_PAYMENT receipt
        - previous_paid == 0 and fully paid in one shot → FULL_PAYMENT receipt
        - previous_paid > 0 and this charge clears total_price → FINAL_SETTLEMENT
        """
        metadata = payment_intent.get("metadata") or {}
        booking_id_raw = metadata.get("booking_id")
        tenant_id_raw = metadata.get("tenant_id")
        if not booking_id_raw or not tenant_id_raw:
            logger.warning(
                "payment_intent.succeeded missing booking/tenant metadata pi=%s",
                payment_intent.get("id"),
            )
            return PaymentCaptureResult(status="ignored_missing_metadata")

        pi_id = str(payment_intent["id"])
        amount_cents = payment_intent.get("amount_received") or payment_intent.get("amount") or 0
        captured = (Decimal(amount_cents) / Decimal(100)).quantize(Decimal("0.01"))

        return await self._capture_payment(
            tenant_id=UUID(str(tenant_id_raw)),
            booking_id=UUID(str(booking_id_raw)),
            amount=captured,
            idempotency_key=f"stripe-pi:{pi_id}",
            stripe_payment_intent_id=pi_id,
            channel="stripe",
            actor_id=None,
            note=None,
        )

    async def record_cash_payment(
        self,
        *,
        tenant_id: UUID,
        booking_id: UUID,
        amount: Decimal,
        channel: CashPaymentChannel,
        idempotency_key: str | None = None,
        actor_id: str | None = None,
        note: str | None = None,
        receipt_number: str | None = None,
    ) -> PaymentCaptureResult:
        key = idempotency_key or f"cash:{channel.value}:{booking_id}:{uuid4().hex[:10]}"
        return await self._capture_payment(
            tenant_id=tenant_id,
            booking_id=booking_id,
            amount=amount.quantize(Decimal("0.01")),
            idempotency_key=key,
            stripe_payment_intent_id=None,
            channel=channel.value,
            actor_id=actor_id,
            note=note,
            receipt_number=receipt_number,
        )

    async def record_bank_deposit(
        self,
        *,
        tenant_id: UUID,
        booking_id: UUID,
        amount: Decimal,
        reference_code: str,
        idempotency_key: str | None = None,
        actor_id: str | None = None,
        note: str | None = None,
    ) -> PaymentCaptureResult:
        ref = reference_code.strip().upper()
        key = idempotency_key or f"bank-deposit:{ref}:{booking_id}"
        return await self._capture_payment(
            tenant_id=tenant_id,
            booking_id=booking_id,
            amount=amount.quantize(Decimal("0.01")),
            idempotency_key=key,
            stripe_payment_intent_id=None,
            channel="bank_transfer",
            actor_id=actor_id,
            note=note or ref,
            receipt_number=None,
        )

    async def _capture_payment(
        self,
        *,
        tenant_id: UUID,
        booking_id: UUID,
        amount: Decimal,
        idempotency_key: str,
        stripe_payment_intent_id: str | None,
        channel: str,
        actor_id: str | None,
        note: str | None,
        receipt_number: str | None = None,
    ) -> PaymentCaptureResult:
        await apply_tenant_rls(self._session, tenant_id)

        if stripe_payment_intent_id:
            dup_pi = await self._session.execute(
                select(FiscalInvoice).where(FiscalInvoice.stripe_payment_intent_id == stripe_payment_intent_id),
            )
            duplicate = dup_pi.scalar_one_or_none()
            if duplicate:
                return PaymentCaptureResult(
                    status="duplicate",
                    booking_id=duplicate.booking_id,
                    fiscal_invoice_id=duplicate.id,
                    amount_captured=duplicate.amount,
                )

        dup_key = await self._session.execute(
            select(FiscalInvoice).where(FiscalInvoice.idempotency_key == idempotency_key),
        )
        duplicate_key = dup_key.scalar_one_or_none()
        if duplicate_key:
            return PaymentCaptureResult(
                status="duplicate",
                booking_id=duplicate_key.booking_id,
                fiscal_invoice_id=duplicate_key.id,
                amount_captured=duplicate_key.amount,
            )

        booking_result = await self._session.execute(
            select(Booking)
            .where(Booking.id == booking_id, Booking.tenant_id == tenant_id)
            .with_for_update(),
        )
        booking = booking_result.scalar_one_or_none()
        if not booking:
            logger.error("Booking not found booking=%s tenant=%s", booking_id, tenant_id)
            return PaymentCaptureResult(status="booking_not_found")

        if booking.status in (BookingStatus.CANCELLED, BookingStatus.REFUNDED):
            return PaymentCaptureResult(status="booking_cancelled")

        previous_paid = booking.amount_paid
        captured = amount
        new_paid = (previous_paid + captured).quantize(Decimal("0.01"))
        if new_paid > booking.total_price:
            logger.warning(
                "Overpayment capped booking=%s total=%s attempted=%s",
                booking.id,
                booking.total_price,
                new_paid,
            )
            captured = max(booking.total_price - previous_paid, Decimal("0"))
            new_paid = previous_paid + captured

        if captured <= 0:
            return PaymentCaptureResult(status="nothing_to_capture")

        invoice_kind = resolve_invoice_kind(
            previous_paid=previous_paid,
            new_paid=new_paid,
            total_price=booking.total_price,
        )

        booking.amount_paid = new_paid
        booking.sync_payment_status()
        if booking.payment_status == PaymentStatus.PAID:
            booking.status = BookingStatus.PAID
        elif booking.payment_status == PaymentStatus.PARTIAL and booking.status == BookingStatus.PENDING:
            booking.status = BookingStatus.CONFIRMED

        meta = dict(booking.metadata_json or {})
        meta["amount_paid"] = float(booking.amount_paid)
        meta["balance_due"] = float(max(booking.total_price - booking.amount_paid, Decimal("0")))
        if stripe_payment_intent_id:
            meta["last_stripe_payment_intent"] = stripe_payment_intent_id
        if channel in (CashPaymentChannel.OFFICE_COUNTER.value, CashPaymentChannel.DRIVER_ON_BUS.value):
            cash_channel = CashPaymentChannel(channel)
            meta["payment_method"] = CHANNEL_LABELS[cash_channel]
            meta["cash_channel"] = channel
            meta["last_cash_collection_at"] = __import__("datetime").datetime.now(
                __import__("datetime").timezone.utc
            ).isoformat()
            if actor_id:
                meta["last_cash_collected_by"] = actor_id
            if receipt_number:
                meta["last_cash_receipt"] = receipt_number
            if note:
                meta["last_cash_note"] = note
        elif channel == "bank_transfer":
            meta["payment_method"] = "Τραπεζική μεταφορά"
            meta["bank_reference"] = note
            meta["bank_deposit_confirmed_at"] = __import__("datetime").datetime.now(
                __import__("datetime").timezone.utc
            ).isoformat()
            if actor_id:
                meta["bank_confirmed_by"] = actor_id
            if note:
                meta["bank_confirm_note"] = note
        booking.metadata_json = meta

        fiscal_invoice = FiscalInvoice(
            tenant_id=tenant_id,
            booking_id=booking.id,
            invoice_kind=invoice_kind,
            status=FiscalInvoiceStatus.PENDING,
            amount=captured,
            currency=booking.currency,
            stripe_payment_intent_id=stripe_payment_intent_id,
            idempotency_key=idempotency_key,
            metadata_json={
                "channel": channel,
                "capture_sequence": len(booking.fiscal_invoices) + 1,
                "actor_id": actor_id,
                "note": note,
                "receipt_number": receipt_number,
            },
        )
        self._session.add(fiscal_invoice)
        await self._session.flush()

        return PaymentCaptureResult(
            status="captured",
            booking_id=booking.id,
            fiscal_invoice_id=fiscal_invoice.id,
            amount_captured=captured,
            payment_status=booking.payment_status.value,
        )

    async def issue_fiscal_invoice_after_commit(self, fiscal_invoice_id: UUID) -> None:
        svc = FiscalInvoiceService(self._session)
        await svc.issue_to_aade(fiscal_invoice_id)
