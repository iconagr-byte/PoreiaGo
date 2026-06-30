"""Map Postgres Booking rows ↔ BackOffice / wallet JSON shape."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from app.models.booking import Booking, BookingStatus, PaymentStatus

try:
    from app.models.fiscal_invoice import FiscalInvoice, FiscalInvoiceKind, FiscalInvoiceStatus
    from app.models.tenant import Tenant
    from app.services.fiscal_invoice_service import build_line_description
    from app.services.fiscal_transmission_service import resolve_issuer_vat
except ImportError:  # pragma: no cover
    FiscalInvoice = Any  # type: ignore
    FiscalInvoiceKind = Any  # type: ignore
    FiscalInvoiceStatus = None  # type: ignore
    Tenant = Any  # type: ignore

GREEK_STATUS: dict[BookingStatus, str] = {
    BookingStatus.PAID: "Επιβεβαιωμένη",
    BookingStatus.CONFIRMED: "Επιβεβαιωμένη",
    BookingStatus.PENDING: "Εκκρεμής",
    BookingStatus.BOARDED: "Ολοκληρώθηκε",
    BookingStatus.CANCELLED: "Ακυρωμένη",
    BookingStatus.REFUNDED: "Ακυρωμένη",
}

STATUS_FROM_GREEK: dict[str, BookingStatus] = {
    "επιβεβαιωμένη": BookingStatus.PAID,
    "confirmed": BookingStatus.CONFIRMED,
    "paid": BookingStatus.PAID,
    "εκκρεμής": BookingStatus.PENDING,
    "pending": BookingStatus.PENDING,
    "ολοκληρώθηκε": BookingStatus.BOARDED,
    "boarded": BookingStatus.BOARDED,
    "checked_in": BookingStatus.BOARDED,
    "ακυρωμένη": BookingStatus.CANCELLED,
    "cancelled": BookingStatus.CANCELLED,
    "refunded": BookingStatus.REFUNDED,
}


def normalize_reference(code: str) -> str:
    c = (code or "").strip().upper().replace(" ", "")
    while c.startswith("B-") and not c.startswith("BK-"):
        c = c[2:]
    if c and not c.startswith("BK-"):
        c = f"BK-{c.removeprefix('BK-').removeprefix('BK')}"
    return c


def local_id_from_reference(reference_code: str) -> str:
    ref = (reference_code or "").strip().upper()
    if ref.startswith("BK-"):
        return f"B-{ref[3:]}"
    if ref.startswith("B-"):
        return ref
    return f"B-{ref}"


def build_fiscal_admin_fields(
    booking: Booking,
    invoices: list[FiscalInvoice] | None = None,
) -> dict[str, Any]:
    invs = list(invoices or [])
    issued = [i for i in invs if i.status == FiscalInvoiceStatus.ISSUED]
    failed = [i for i in invs if i.status == FiscalInvoiceStatus.FAILED]
    in_flight = [
        i
        for i in invs
        if i.status in (FiscalInvoiceStatus.PENDING, FiscalInvoiceStatus.QUEUED)
    ]

    marks = [i.aade_mark for i in issued if i.aade_mark]
    primary_mark = booking.fiscal_mark or (marks[-1] if marks else None)

    provider: str | None = None
    for inv in reversed(issued + failed):
        meta = inv.metadata_json or {}
        raw = meta.get("fiscal_provider")
        if raw:
            provider = str(raw)
            break

    if issued:
        fiscal_status = "issued"
    elif in_flight:
        fiscal_status = "pending"
    elif failed:
        fiscal_status = "failed"
    else:
        fiscal_status = None

    receipts = [
        {
            "id": str(inv.id),
            "kind": inv.invoice_kind.value,
            "amount": float(inv.amount),
            "mark": inv.aade_mark,
            "status": inv.status.value,
            "provider": (inv.metadata_json or {}).get("fiscal_provider"),
            "error_message": inv.error_message,
        }
        for inv in invs
    ]

    return {
        "fiscal_mark": primary_mark,
        "fiscal_marks": marks,
        "fiscal_provider": provider,
        "fiscal_status": fiscal_status,
        "fiscal_invoice_count": len(invs),
        "fiscal_receipts": receipts,
    }


def build_fiscal_customer_fields(
    booking: Booking,
    invoices: list[FiscalInvoice] | None = None,
    *,
    tenant: Tenant | None = None,
) -> dict[str, Any]:
    """Customer-safe fiscal snapshot (no internal invoice ids / error details)."""
    admin = build_fiscal_admin_fields(booking, invoices)
    receipts = [
        {
            "kind": r["kind"],
            "amount": r["amount"],
            "mark": r["mark"],
            "status": r["status"],
        }
        for r in admin.get("fiscal_receipts", [])
    ]
    mark = admin.get("fiscal_mark")
    provider = admin.get("fiscal_provider")
    status = admin.get("fiscal_status")
    marks = admin.get("fiscal_marks") or []
    meta = booking.metadata_json if isinstance(booking.metadata_json, dict) else {}
    trip_title = meta.get("trip_title")

    documents: list[dict[str, Any]] = []
    for inv in invoices or []:
        if inv.status != FiscalInvoiceStatus.ISSUED or not inv.aade_mark:
            continue
        inv_meta = inv.metadata_json if isinstance(inv.metadata_json, dict) else {}
        credited_mark = inv_meta.get("credited_mark") if inv.invoice_kind == FiscalInvoiceKind.CREDIT_NOTE else None
        issued_at = inv.updated_at.date().isoformat() if inv.updated_at else None
        documents.append(
            {
                "kind": inv.invoice_kind.value,
                "amount_eur": float(inv.amount),
                "mark": inv.aade_mark,
                "issued_at": issued_at,
                "description": build_line_description(
                    inv.invoice_kind,
                    trip_title,
                    booking.reference_code,
                    credited_mark=str(credited_mark) if credited_mark else None,
                ),
                "is_credit": inv.invoice_kind == FiscalInvoiceKind.CREDIT_NOTE,
            },
        )

    result: dict[str, Any] = {
        "fiscal_mark": mark,
        "fiscalMark": mark,
        "fiscal_marks": marks,
        "fiscalMarks": marks,
        "fiscal_provider": provider,
        "fiscalProvider": provider,
        "fiscal_status": status,
        "fiscalStatus": status,
        "fiscal_receipts": receipts,
        "fiscalReceipts": receipts,
        "fiscal_documents": documents,
        "fiscalDocuments": documents,
    }

    if tenant is not None:
        result.update(
            {
                "issuer_name": tenant.legal_name,
                "issuerName": tenant.legal_name,
                "issuer_vat": resolve_issuer_vat(tenant.settings_json),
                "issuerVat": resolve_issuer_vat(tenant.settings_json),
                "booking_reference": booking.reference_code,
                "bookingReference": booking.reference_code,
                "customer_name": booking.passenger_name,
                "customerName": booking.passenger_name,
                "trip_title": trip_title or "—",
                "tripTitle": trip_title or "—",
            },
        )
    return result


def booking_to_admin_dict(
    booking: Booking,
    *,
    fiscal_invoices: list[FiscalInvoice] | None = None,
) -> dict[str, Any]:
    meta: dict[str, Any] = dict(booking.metadata_json or {})
    created: datetime = booking.created_at
    seats = meta.get("seats") or []
    if not seats and booking.seat_label:
        seats = [s.strip() for s in booking.seat_label.split(",") if s.strip()]

    status = booking.status
    greek_status = GREEK_STATUS.get(status, status.value)
    paid = status in (BookingStatus.PAID, BookingStatus.CONFIRMED, BookingStatus.BOARDED)
    checked_in = bool(meta.get("checked_in")) or status == BookingStatus.BOARDED
    check_in_status = meta.get("check_in_status") or ("CHECKED_IN" if checked_in else "NONE")

    trip_id = meta.get("external_trip_id") or meta.get("trip_id") or 0
    total_eur = float(booking.total_price or meta.get("total_eur") or booking.amount_eur)
    amount_paid = float(booking.amount_paid if booking.amount_paid is not None else meta.get("amount_paid") or booking.amount_eur)
    balance_due = float(meta.get("balance_due") or 0)
    payment_plan = meta.get("payment_plan") or ("deposit" if balance_due > 0 else "full")
    deposit_percent = int(meta.get("deposit_percent") or (30 if balance_due > 0 else 0))

    if balance_due > 0:
        payment_status = meta.get("payment_status") or f"DEPOSIT {deposit_percent}% (Online)"
    elif paid:
        payment_status = meta.get("payment_status") or "PAID (SaaS)"
    else:
        payment_status = meta.get("payment_status") or status.value.upper()

    result = {
        "id": local_id_from_reference(booking.reference_code),
        "saasBookingId": str(booking.id),
        "syncedToSaas": True,
        "customerName": booking.passenger_name,
        "customerId": str(booking.customer_user_id) if booking.customer_user_id else None,
        "tripTitle": meta.get("trip_title") or "—",
        "tripId": trip_id,
        "date": created.strftime("%Y-%m-%d") if created else "",
        "time": created.strftime("%H:%M") if created else "",
        "seats": seats,
        "seat": booking.seat_label or ", ".join(seats),
        "price": total_eur,
        "amount": total_eur,
        "amountPaid": amount_paid,
        "balanceDue": balance_due,
        "paymentPlan": payment_plan,
        "depositPercent": deposit_percent if balance_due > 0 else None,
        "balanceDueMethod": meta.get("balance_due_method"),
        "status": greek_status,
        "checkInStatus": check_in_status,
        "checkedIn": checked_in,
        "phone": meta.get("phone") or "",
        "email": booking.passenger_email or "",
        "paymentStatus": payment_status,
        "paymentMethod": meta.get("payment_method") or "Online",
        "pnr": booking.reference_code,
        "boardingPassIssued": paid,
        "bookingSource": meta.get("source") or "Postgres",
        "passenger_vat_id": booking.passenger_vat_id,
        "notes": booking.notes,
    }
    result.update(build_fiscal_admin_fields(booking, fiscal_invoices))
    return result


def parse_status(value: str | None) -> BookingStatus | None:
    if not value:
        return None
    key = value.strip().lower()
    return STATUS_FROM_GREEK.get(key)


def admin_patch_to_booking_fields(patch: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    meta_patch: dict[str, Any] = {}

    if "status" in patch and patch["status"] is not None:
        parsed = parse_status(str(patch["status"]))
        if parsed:
            out["status"] = parsed

    if patch.get("checkedIn") is not None:
        meta_patch["checked_in"] = bool(patch["checkedIn"])
        if patch["checkedIn"]:
            out["status"] = BookingStatus.BOARDED
            meta_patch["check_in_status"] = patch.get("checkInStatus") or "CHECKED_IN"
        else:
            meta_patch["check_in_status"] = "NONE"

    if patch.get("checkInStatus") is not None:
        meta_patch["check_in_status"] = patch["checkInStatus"]

    for key in ("trip_title", "external_trip_id", "phone", "payment_method", "seats", "payment_status", "bank_account_id"):
        if key in patch and patch[key] is not None:
            meta_patch[key] = patch[key]

    if patch.get("paymentMethod") is not None:
        meta_patch["payment_method"] = patch["paymentMethod"]
    if patch.get("paymentStatus") is not None:
        meta_patch["payment_status"] = patch["paymentStatus"]
    if patch.get("amountPaid") is not None:
        meta_patch["amount_paid"] = float(patch["amountPaid"])
    if patch.get("balanceDue") is not None:
        meta_patch["balance_due"] = float(patch["balanceDue"])
    if patch.get("boardingPassIssued") is not None:
        meta_patch["boarding_pass_issued"] = bool(patch["boardingPassIssued"])

    if patch.get("notes") is not None:
        out["notes"] = patch["notes"]

    if meta_patch:
        out["_metadata_patch"] = meta_patch

    return out


def apply_patch_to_booking(booking: Booking, patch: dict[str, Any]) -> None:
    fields = admin_patch_to_booking_fields(patch)
    meta_patch = fields.pop("_metadata_patch", None)
    for key, value in fields.items():
        setattr(booking, key, value)
    if meta_patch:
        current = dict(booking.metadata_json or {})
        current.update(meta_patch)
        booking.metadata_json = current


def seed_booking_kwargs(
    *,
    tenant_id: UUID,
    reference_code: str,
    passenger_name: str,
    passenger_email: str,
    amount_eur: float,
    status: BookingStatus,
    trip_title: str,
    external_trip_id: int,
    seat_label: str,
    seats: list[str],
    phone: str = "",
    payment_method: str = "Online",
    checked_in: bool = False,
) -> dict[str, Any]:
    meta = {
        "external_trip_id": external_trip_id,
        "trip_title": trip_title,
        "seats": seats,
        "phone": phone,
        "payment_method": payment_method,
        "source": "seed",
    }
    if checked_in:
        meta["checked_in"] = True
        meta["check_in_status"] = "CHECKED_IN"

    paid_amount = Decimal(str(amount_eur))
    if status in (BookingStatus.PAID, BookingStatus.BOARDED, BookingStatus.CONFIRMED):
        payment_status = PaymentStatus.PAID
        paid_amount = Decimal(str(amount_eur))
    elif status == BookingStatus.PENDING:
        payment_status = PaymentStatus.PENDING
        paid_amount = Decimal("0")
    else:
        payment_status = PaymentStatus.PAID
        paid_amount = Decimal(str(amount_eur))

    return {
        "tenant_id": tenant_id,
        "reference_code": normalize_reference(reference_code),
        "passenger_name": passenger_name,
        "passenger_email": passenger_email,
        "total_price": Decimal(str(amount_eur)),
        "amount_paid": paid_amount,
        "payment_status": payment_status,
        "amount_eur": Decimal(str(amount_eur)),
        "status": status,
        "seat_label": seat_label,
        "metadata_json": meta,
    }
