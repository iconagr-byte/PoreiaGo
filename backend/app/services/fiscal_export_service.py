"""Export fiscal invoices for accounting / myDATA reconciliation."""

from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.admin_booking_mapper import local_id_from_reference
from app.core.auth_deps import apply_tenant_rls
from app.models.booking import Booking
from app.models.fiscal_invoice import FiscalInvoice, FiscalInvoiceKind, FiscalInvoiceStatus

INVOICE_KIND_LABELS = {
    FiscalInvoiceKind.DOWN_PAYMENT: "Προκαταβολή",
    FiscalInvoiceKind.FINAL_SETTLEMENT: "Εξόφληση υπολοίπου",
    FiscalInvoiceKind.FULL_PAYMENT: "Πλήρης πληρωμή",
}

STATUS_LABELS = {
    FiscalInvoiceStatus.PENDING: "Εκκρεμεί",
    FiscalInvoiceStatus.QUEUED: "Σε ουρά",
    FiscalInvoiceStatus.ISSUED: "Εκδόθηκε",
    FiscalInvoiceStatus.FAILED: "Αποτυχία",
}


def fiscal_export_row(invoice: FiscalInvoice, booking: Booking) -> dict[str, Any]:
    meta = booking.metadata_json if isinstance(booking.metadata_json, dict) else {}
    inv_meta = invoice.metadata_json if isinstance(invoice.metadata_json, dict) else {}
    updated = invoice.updated_at
    created = invoice.created_at
    return {
        "created_at": created.isoformat() if created else "",
        "updated_at": updated.isoformat() if updated else "",
        "booking_id": local_id_from_reference(booking.reference_code),
        "pnr": booking.reference_code,
        "customer_name": booking.passenger_name or "",
        "customer_email": booking.passenger_email or "",
        "trip_title": meta.get("trip_title") or "",
        "invoice_id": str(invoice.id),
        "invoice_kind": INVOICE_KIND_LABELS.get(invoice.invoice_kind, invoice.invoice_kind.value),
        "status": STATUS_LABELS.get(invoice.status, invoice.status.value),
        "amount_eur": float(invoice.amount),
        "mark": invoice.aade_mark or "",
        "provider": inv_meta.get("fiscal_provider") or "",
        "channel": inv_meta.get("channel") or "",
        "error_message": invoice.error_message or "",
        "auto_retry_count": int(inv_meta.get("auto_retry_count") or 0),
    }


def serialize_fiscal_invoices_csv(rows: list[dict[str, Any]]) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "Δημιουργία UTC",
        "Ενημέρωση UTC",
        "Κράτηση",
        "PNR",
        "Πελάτης",
        "Email",
        "Εκδρομή",
        "Invoice ID",
        "Τύπος",
        "Κατάσταση",
        "Ποσό EUR",
        "MARK",
        "Πάροχος",
        "Κανάλι",
        "Auto retries",
        "Σφάλμα",
    ])
    for row in rows:
        writer.writerow([
            row.get("created_at", ""),
            row.get("updated_at", ""),
            row.get("booking_id", ""),
            row.get("pnr", ""),
            row.get("customer_name", ""),
            row.get("customer_email", ""),
            row.get("trip_title", ""),
            row.get("invoice_id", ""),
            row.get("invoice_kind", ""),
            row.get("status", ""),
            row.get("amount_eur", ""),
            row.get("mark", ""),
            row.get("provider", ""),
            row.get("channel", ""),
            row.get("auto_retry_count", 0),
            row.get("error_message", ""),
        ])
    return ("\ufeff" + buffer.getvalue()).encode("utf-8")


class FiscalExportService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_rows(
        self,
        tenant_id: UUID,
        *,
        days: int = 90,
        status: str | None = None,
        limit: int = 2000,
    ) -> list[dict[str, Any]]:
        await apply_tenant_rls(self._session, tenant_id)
        window_start = datetime.now(timezone.utc) - timedelta(days=days)
        limit = max(1, min(limit, 5000))

        stmt = (
            select(FiscalInvoice, Booking)
            .join(Booking, Booking.id == FiscalInvoice.booking_id)
            .where(
                FiscalInvoice.tenant_id == tenant_id,
                FiscalInvoice.created_at >= window_start,
            )
            .order_by(FiscalInvoice.created_at.desc())
            .limit(limit)
        )
        if status:
            try:
                status_enum = FiscalInvoiceStatus(status.strip().lower())
            except ValueError as exc:
                raise ValueError(f"Invalid status: {status}") from exc
            stmt = stmt.where(FiscalInvoice.status == status_enum)

        result = await self._session.execute(stmt)
        return [fiscal_export_row(inv, booking) for inv, booking in result.all()]
