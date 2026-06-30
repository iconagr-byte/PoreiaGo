"""Retry failed fiscal receipt issuance."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_deps import apply_tenant_rls
from app.models.booking import Booking
from app.models.fiscal_invoice import FiscalInvoice, FiscalInvoiceStatus
from app.services.payment_dispatch import dispatch_fiscal_receipt


class FiscalRetryService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def retry_invoice(
        self,
        *,
        tenant_id: UUID,
        invoice_id: UUID,
        trigger: str = "manual",
    ) -> FiscalInvoice:
        await apply_tenant_rls(self._session, tenant_id)
        result = await self._session.execute(
            select(FiscalInvoice).where(
                FiscalInvoice.id == invoice_id,
                FiscalInvoice.tenant_id == tenant_id,
            ),
        )
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise ValueError("Fiscal invoice not found")

        if invoice.status == FiscalInvoiceStatus.ISSUED:
            return invoice

        if invoice.status not in (
            FiscalInvoiceStatus.FAILED,
            FiscalInvoiceStatus.PENDING,
            FiscalInvoiceStatus.QUEUED,
        ):
            raise ValueError(f"Cannot retry fiscal invoice in status {invoice.status.value}")

        invoice.status = FiscalInvoiceStatus.PENDING
        invoice.error_message = None
        invoice.aade_submission_id = None
        await self._session.flush()

        from api.admin_booking_mapper import local_id_from_reference
        from travel_platform.payments.fiscal_audit import record_fiscal_audit

        booking_row = await self._session.execute(
            select(Booking).where(Booking.id == invoice.booking_id),
        )
        booking = booking_row.scalar_one_or_none()
        if booking:
            record_fiscal_audit(
                action="fiscal_receipt_retry",
                booking_id=local_id_from_reference(booking.reference_code),
                amount_eur=float(invoice.amount),
                detail="Αυτόματη επανάληψη" if trigger == "auto" else None,
                metadata={"invoice_id": str(invoice.id), "trigger": trigger},
            )

        dispatch_fiscal_receipt(str(invoice.id))
        return invoice

    async def booking_view_after_retry(self, *, tenant_id: UUID, invoice_id: UUID) -> dict:
        from api.admin_booking_mapper import booking_to_admin_dict

        invoice = await self.retry_invoice(tenant_id=tenant_id, invoice_id=invoice_id)
        booking_row = await self._session.execute(
            select(Booking).where(Booking.id == invoice.booking_id, Booking.tenant_id == tenant_id),
        )
        booking = booking_row.scalar_one_or_none()
        if not booking:
            raise ValueError("Booking not found")

        inv_result = await self._session.execute(
            select(FiscalInvoice)
            .where(FiscalInvoice.booking_id == booking.id)
            .order_by(FiscalInvoice.created_at),
        )
        fiscal_invoices = list(inv_result.scalars().all())
        return booking_to_admin_dict(booking, fiscal_invoices=fiscal_invoices)
