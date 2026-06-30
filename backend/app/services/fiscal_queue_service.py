"""Admin view of pending / failed fiscal receipts."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.admin_booking_mapper import local_id_from_reference
from app.core.auth_deps import apply_tenant_rls
from app.models.booking import Booking
from app.models.fiscal_invoice import FiscalInvoice, FiscalInvoiceStatus


def fiscal_queue_item(invoice: FiscalInvoice, booking: Booking) -> dict[str, Any]:
    meta = booking.metadata_json if isinstance(booking.metadata_json, dict) else {}
    inv_meta = invoice.metadata_json if isinstance(invoice.metadata_json, dict) else {}
    return {
        "invoice_id": str(invoice.id),
        "booking_id": local_id_from_reference(booking.reference_code),
        "saas_booking_id": str(booking.id),
        "pnr": booking.reference_code,
        "customer_name": booking.passenger_name,
        "trip_title": meta.get("trip_title") or "—",
        "amount": float(invoice.amount),
        "status": invoice.status.value,
        "invoice_kind": invoice.invoice_kind.value,
        "mark": invoice.aade_mark,
        "error_message": invoice.error_message,
        "provider": inv_meta.get("fiscal_provider"),
        "channel": inv_meta.get("channel"),
        "updated_at": invoice.updated_at.isoformat() if invoice.updated_at else None,
    }


class FiscalQueueService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_open_items(self, tenant_id: UUID, *, limit: int = 100) -> list[dict[str, Any]]:
        await apply_tenant_rls(self._session, tenant_id)
        result = await self._session.execute(
            select(FiscalInvoice, Booking)
            .join(Booking, Booking.id == FiscalInvoice.booking_id)
            .where(
                FiscalInvoice.tenant_id == tenant_id,
                FiscalInvoice.status.in_(
                    (
                        FiscalInvoiceStatus.PENDING,
                        FiscalInvoiceStatus.QUEUED,
                        FiscalInvoiceStatus.FAILED,
                    ),
                ),
            )
            .order_by(FiscalInvoice.updated_at.desc())
            .limit(limit),
        )
        return [fiscal_queue_item(inv, booking) for inv, booking in result.all()]
