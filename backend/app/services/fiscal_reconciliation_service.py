"""Reconcile captured payments vs issued fiscal receipts."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.admin_booking_mapper import local_id_from_reference
from app.core.auth_deps import apply_tenant_rls
from app.models.booking import Booking
from app.models.fiscal_invoice import FiscalInvoice, FiscalInvoiceStatus

GAP_TOLERANCE = Decimal("0.01")


def _money(value: Decimal | float | int) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.01")))


def reconciliation_row(booking: Booking, invoices: list[FiscalInvoice]) -> dict[str, Any]:
    meta = booking.metadata_json if isinstance(booking.metadata_json, dict) else {}
    paid = Decimal(str(booking.amount_paid or 0)).quantize(Decimal("0.01"))
    issued_total = sum(
        (
            Decimal(str(inv.amount))
            for inv in invoices
            if inv.status == FiscalInvoiceStatus.ISSUED
        ),
        Decimal("0"),
    ).quantize(Decimal("0.01"))
    gap = (paid - issued_total).quantize(Decimal("0.01"))

    failed = [inv for inv in invoices if inv.status == FiscalInvoiceStatus.FAILED]
    in_flight = [
        inv
        for inv in invoices
        if inv.status in (FiscalInvoiceStatus.PENDING, FiscalInvoiceStatus.QUEUED)
    ]
    marks = [inv.aade_mark for inv in invoices if inv.aade_mark]

    if failed:
        status = "failed_receipt"
    elif in_flight:
        status = "in_progress"
    elif gap > GAP_TOLERANCE:
        status = "missing_fiscal"
    elif paid <= 0:
        status = "no_payment"
    else:
        status = "matched"

    return {
        "booking_id": local_id_from_reference(booking.reference_code),
        "pnr": booking.reference_code,
        "customer_name": booking.passenger_name,
        "trip_title": meta.get("trip_title") or "—",
        "amount_paid_eur": _money(paid),
        "issued_fiscal_eur": _money(issued_total),
        "gap_eur": _money(gap),
        "status": status,
        "fiscal_invoice_count": len(invoices),
        "failed_count": len(failed),
        "in_flight_count": len(in_flight),
        "failed_invoice_id": str(failed[-1].id) if failed else None,
        "marks": marks,
        "updated_at": booking.updated_at.isoformat() if booking.updated_at else None,
    }


def serialize_reconciliation_csv(rows: list[dict[str, Any]]) -> bytes:
    import csv
    import io

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "Κράτηση",
        "PNR",
        "Πελάτης",
        "Εκδρομή",
        "Πληρώθηκε EUR",
        "Εκδόθηκε fiscal EUR",
        "Κενό EUR",
        "Κατάσταση",
        "Αποδείξεις",
        "MARKs",
    ])
    status_labels = {
        "matched": "Συμφωνία",
        "missing_fiscal": "Λείπει fiscal",
        "failed_receipt": "Αποτυχία",
        "in_progress": "Σε εξέλιξη",
        "no_payment": "Χωρίς πληρωμή",
    }
    for row in rows:
        writer.writerow([
            row.get("booking_id", ""),
            row.get("pnr", ""),
            row.get("customer_name", ""),
            row.get("trip_title", ""),
            row.get("amount_paid_eur", ""),
            row.get("issued_fiscal_eur", ""),
            row.get("gap_eur", ""),
            status_labels.get(row.get("status", ""), row.get("status", "")),
            row.get("fiscal_invoice_count", 0),
            ", ".join(row.get("marks") or []),
        ])
    return ("\ufeff" + buffer.getvalue()).encode("utf-8")


class FiscalReconciliationService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def run(
        self,
        tenant_id: UUID,
        *,
        days: int = 90,
        only_gaps: bool = False,
        limit: int = 500,
    ) -> dict[str, Any]:
        await apply_tenant_rls(self._session, tenant_id)
        window_start = datetime.now(timezone.utc) - timedelta(days=days)
        limit = max(1, min(limit, 2000))

        booking_result = await self._session.execute(
            select(Booking)
            .where(
                Booking.tenant_id == tenant_id,
                Booking.amount_paid > 0,
                Booking.updated_at >= window_start,
            )
            .order_by(Booking.updated_at.desc())
            .limit(limit),
        )
        bookings = list(booking_result.scalars().all())
        if not bookings:
            return {
                "window_days": days,
                "total_bookings": 0,
                "matched": 0,
                "with_gaps": 0,
                "failed": 0,
                "in_progress": 0,
                "total_paid_eur": 0.0,
                "total_issued_eur": 0.0,
                "total_gap_eur": 0.0,
                "items": [],
            }

        booking_ids = [b.id for b in bookings]
        inv_result = await self._session.execute(
            select(FiscalInvoice)
            .where(
                FiscalInvoice.tenant_id == tenant_id,
                FiscalInvoice.booking_id.in_(booking_ids),
            )
            .order_by(FiscalInvoice.created_at),
        )
        invoices_by_booking: dict[UUID, list[FiscalInvoice]] = {}
        for inv in inv_result.scalars().all():
            invoices_by_booking.setdefault(inv.booking_id, []).append(inv)

        rows = [
            reconciliation_row(booking, invoices_by_booking.get(booking.id, []))
            for booking in bookings
        ]
        if only_gaps:
            rows = [r for r in rows if r["status"] != "matched"]

        matched = sum(1 for r in rows if r["status"] == "matched")
        with_gaps = sum(1 for r in rows if r["status"] == "missing_fiscal")
        failed = sum(1 for r in rows if r["status"] == "failed_receipt")
        in_progress = sum(1 for r in rows if r["status"] == "in_progress")

        # Summary from full booking set before only_gaps filter
        all_rows = [
            reconciliation_row(booking, invoices_by_booking.get(booking.id, []))
            for booking in bookings
        ]
        total_paid = sum(r["amount_paid_eur"] for r in all_rows)
        total_issued = sum(r["issued_fiscal_eur"] for r in all_rows)
        total_gap = sum(max(r["gap_eur"], 0) for r in all_rows)

        return {
            "window_days": days,
            "total_bookings": len(bookings),
            "matched": sum(1 for r in all_rows if r["status"] == "matched"),
            "with_gaps": sum(1 for r in all_rows if r["status"] == "missing_fiscal"),
            "failed": sum(1 for r in all_rows if r["status"] == "failed_receipt"),
            "in_progress": sum(1 for r in all_rows if r["status"] == "in_progress"),
            "total_paid_eur": round(total_paid, 2),
            "total_issued_eur": round(total_issued, 2),
            "total_gap_eur": round(total_gap, 2),
            "items": rows,
        }
