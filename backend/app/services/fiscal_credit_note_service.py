"""Issue fiscal credit notes when a paid booking is cancelled."""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_deps import apply_tenant_rls
from app.models.booking import Booking
from app.models.fiscal_invoice import FiscalInvoice, FiscalInvoiceKind, FiscalInvoiceStatus
from app.services.fiscal_invoice_service import FiscalInvoiceService
from app.services.fiscal_transmission_service import resolve_credit_document_category
from travel_platform.payments.fiscal_audit import record_fiscal_audit

logger = logging.getLogger(__name__)


class FiscalCreditNoteService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_for_cancelled_booking(
        self,
        *,
        tenant_id: UUID,
        booking_id: UUID,
    ) -> list[UUID]:
        """
        Create credit-note FiscalInvoice rows for each issued receipt on the booking.

        Idempotent per original invoice (`credit-note:{original_id}`).
        """
        await apply_tenant_rls(self._session, tenant_id)

        booking_row = await self._session.execute(
            select(Booking).where(Booking.id == booking_id, Booking.tenant_id == tenant_id),
        )
        booking = booking_row.scalar_one_or_none()
        if not booking:
            raise ValueError("Booking not found")

        inv_result = await self._session.execute(
            select(FiscalInvoice)
            .where(FiscalInvoice.booking_id == booking_id, FiscalInvoice.tenant_id == tenant_id)
            .order_by(FiscalInvoice.created_at),
        )
        invoices = list(inv_result.scalars().all())

        issued = [
            inv
            for inv in invoices
            if inv.status == FiscalInvoiceStatus.ISSUED and inv.aade_mark
        ]
        if not issued:
            return []

        existing_credit_for = {
            str((inv.metadata_json or {}).get("credited_invoice_id"))
            for inv in invoices
            if inv.invoice_kind == FiscalInvoiceKind.CREDIT_NOTE
        }
        existing_keys = {inv.idempotency_key for inv in invoices}

        created_ids: list[UUID] = []
        trip_title = (booking.metadata_json or {}).get("trip_title") if booking.metadata_json else None

        for original in issued:
            if str(original.id) in existing_credit_for:
                continue
            idempotency_key = f"credit-note:{original.id}"
            if idempotency_key in existing_keys:
                continue

            original_meta = original.metadata_json if isinstance(original.metadata_json, dict) else {}
            original_payload = original_meta.get("aade_payload") or {}
            document_category = resolve_credit_document_category(
                booking=booking,
                original_payload=original_payload if isinstance(original_payload, dict) else {},
            ).value

            credit = FiscalInvoice(
                tenant_id=tenant_id,
                booking_id=booking_id,
                invoice_kind=FiscalInvoiceKind.CREDIT_NOTE,
                status=FiscalInvoiceStatus.PENDING,
                amount=Decimal(str(original.amount)).quantize(Decimal("0.01")),
                currency=original.currency or "EUR",
                idempotency_key=idempotency_key,
                metadata_json={
                    "credited_invoice_id": str(original.id),
                    "credited_mark": original.aade_mark,
                    "credited_kind": original.invoice_kind.value,
                    "document_category": document_category,
                    "original_aade_payload": original_payload,
                    "trip_title": trip_title,
                    "trigger": "booking_cancelled",
                },
            )
            self._session.add(credit)
            await self._session.flush()

            await FiscalInvoiceService(self._session).issue_to_aade(credit.id)
            created_ids.append(credit.id)

            from api.admin_booking_mapper import local_id_from_reference

            record_fiscal_audit(
                action="fiscal_credit_note_queued",
                booking_id=local_id_from_reference(booking.reference_code),
                amount_eur=float(credit.amount),
                detail=f"Credit note for MARK {original.aade_mark}",
                metadata={
                    "credit_invoice_id": str(credit.id),
                    "credited_invoice_id": str(original.id),
                    "credited_mark": original.aade_mark,
                },
            )

        if created_ids:
            meta = dict(booking.metadata_json or {})
            meta["fiscal_credit_notes_pending"] = len(created_ids)
            booking.metadata_json = meta
            await self._session.flush()
            logger.info(
                "Queued %s fiscal credit note(s) for cancelled booking=%s",
                len(created_ids),
                booking_id,
            )

        return created_ids
