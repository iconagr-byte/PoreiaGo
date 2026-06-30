"""Manually issue fiscal receipt when payment exists but fiscal pipeline missed."""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.admin_booking_mapper import booking_to_admin_dict, local_id_from_reference
from app.core.auth_deps import apply_tenant_rls
from app.models.booking import Booking
from app.models.fiscal_invoice import FiscalInvoice, FiscalInvoiceStatus
from app.services.fiscal_invoice_service import resolve_invoice_kind
from app.services.payment_dispatch import dispatch_fiscal_receipt
from travel_platform.payments.fiscal_audit import record_fiscal_audit


class FiscalManualIssueService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def issue_missing_receipt(
        self,
        *,
        tenant_id: UUID,
        booking_id: UUID,
        actor_id: str | None = None,
        note: str | None = None,
    ) -> dict:
        await apply_tenant_rls(self._session, tenant_id)
        booking_row = await self._session.execute(
            select(Booking)
            .where(Booking.id == booking_id, Booking.tenant_id == tenant_id)
            .with_for_update(),
        )
        booking = booking_row.scalar_one_or_none()
        if not booking:
            raise ValueError("Booking not found")

        if booking.amount_paid <= 0:
            raise ValueError("Booking has no captured payments to fiscalize")

        inv_result = await self._session.execute(
            select(FiscalInvoice)
            .where(FiscalInvoice.booking_id == booking.id)
            .order_by(FiscalInvoice.created_at),
        )
        invoices = list(inv_result.scalars().all())

        in_flight = [
            inv
            for inv in invoices
            if inv.status in (FiscalInvoiceStatus.PENDING, FiscalInvoiceStatus.QUEUED)
        ]
        if in_flight:
            raise ValueError("Fiscal issuance already in progress for this booking")

        failed = [inv for inv in invoices if inv.status == FiscalInvoiceStatus.FAILED]
        if failed:
            raise ValueError("Booking has failed fiscal receipts — use retry instead")

        issued_total = sum(
            (inv.amount for inv in invoices if inv.status == FiscalInvoiceStatus.ISSUED),
            Decimal("0"),
        )
        gap = (booking.amount_paid - issued_total).quantize(Decimal("0.01"))
        if gap <= 0:
            raise ValueError("All captured payments already have fiscal receipts")

        previous_paid = issued_total
        new_paid = booking.amount_paid
        invoice_kind = resolve_invoice_kind(
            previous_paid=previous_paid,
            new_paid=new_paid,
            total_price=booking.total_price,
        )

        invoice = FiscalInvoice(
            tenant_id=tenant_id,
            booking_id=booking.id,
            invoice_kind=invoice_kind,
            status=FiscalInvoiceStatus.PENDING,
            amount=gap,
            currency=booking.currency,
            idempotency_key=f"manual-issue:{booking.id}:{uuid4().hex[:10]}",
            metadata_json={
                "channel": "manual",
                "actor_id": actor_id,
                "note": note,
                "capture_sequence": len(invoices) + 1,
            },
        )
        self._session.add(invoice)
        await self._session.flush()

        record_fiscal_audit(
            action="fiscal_manual_issue",
            booking_id=local_id_from_reference(booking.reference_code),
            amount_eur=float(gap),
            actor_id=actor_id,
            detail=note or "Manual fiscal receipt triggered",
            metadata={
                "invoice_id": str(invoice.id),
                "invoice_kind": invoice.invoice_kind.value,
            },
        )

        dispatch_fiscal_receipt(str(invoice.id))

        refreshed = await self._session.execute(
            select(FiscalInvoice).where(FiscalInvoice.booking_id == booking.id).order_by(FiscalInvoice.created_at),
        )
        fiscal_invoices = list(refreshed.scalars().all())
        return booking_to_admin_dict(booking, fiscal_invoices=fiscal_invoices)
