"""Fiscal receipt bridge for rental bookings — AADE/myDATA via shadow Booking when possible.

AADE_MODE=stub returns MARK-STUB-* marks from the AADE gateway (see aade_gateway transmit stub).
On any pipeline failure we keep the LOCAL-{uuid} fallback so desk ops never block.
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _as_uuid(value: Any) -> UUID | None:
    try:
        return UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        return None


async def _try_aade_via_shadow_booking(
    booking: dict[str, Any],
    *,
    amount: float,
) -> str | None:
    """Create/find a minimal ticket Booking linked by metadata rental_booking_id, issue FiscalInvoice.

    Prefer FiscalInvoiceService.issue_to_aade (sync-friendly via asyncio). Falls back to
    dispatch_fiscal_receipt when the invoice is already pending.
    Returns fiscal_mark (incl. MARK-STUB when AADE_MODE=stub) or None on failure.
    """
    from sqlalchemy import select

    from app.core.database import AsyncSessionLocal
    from app.models.booking import Booking, BookingStatus, PaymentStatus
    from app.models.fiscal_invoice import FiscalInvoice, FiscalInvoiceKind, FiscalInvoiceStatus
    from app.services.fiscal_invoice_service import FiscalInvoiceService
    from app.services.payment_dispatch import dispatch_fiscal_receipt

    rental_id = str(booking.get("id") or "").strip()
    tid = _as_uuid(booking.get("tenant_id"))
    if not rental_id or not tid:
        return None

    paid = Decimal(str(round(float(amount or 0), 2)))
    if paid <= 0:
        return None

    async with AsyncSessionLocal() as session:
        # Find existing shadow booking by metadata.
        result = await session.execute(
            select(Booking).where(Booking.tenant_id == tid),
        )
        shadow: Booking | None = None
        for row in result.scalars().all():
            meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
            if str(meta.get("rental_booking_id") or "") == rental_id:
                shadow = row
                break

        if shadow is None:
            ref = f"RENT-{rental_id[:8].upper()}"
            shadow = Booking(
                id=uuid4(),
                tenant_id=tid,
                trip_id=None,
                reference_code=ref[:32],
                status=BookingStatus.CONFIRMED,
                payment_status=PaymentStatus.PAID if paid > 0 else PaymentStatus.PENDING,
                passenger_name=str(booking.get("client_name") or "Rental")[:255],
                passenger_email=(str(booking.get("client_email") or "").strip().lower() or None),
                passenger_vat_id=(str(booking.get("client_afm") or "").strip() or None),
                total_price=paid,
                amount_paid=paid,
                amount_eur=paid,
                currency="EUR",
                metadata_json={
                    "rental_booking_id": rental_id,
                    "trip_title": f"Ενοικίαση {booking.get('vehicle_plate') or booking.get('vehicle_model') or ''}".strip(),
                    "source": "fleet_rental",
                },
                notes=f"Shadow booking for rental {rental_id}",
            )
            session.add(shadow)
            await session.flush()

        # Reuse existing issued invoice mark when present.
        existing_inv = await session.execute(
            select(FiscalInvoice)
            .where(
                FiscalInvoice.booking_id == shadow.id,
                FiscalInvoice.tenant_id == tid,
            )
            .order_by(FiscalInvoice.created_at.desc())
        )
        prior = existing_inv.scalars().first()
        if prior and prior.aade_mark and prior.status == FiscalInvoiceStatus.ISSUED:
            return str(prior.aade_mark)

        idem = f"rental-receipt:{rental_id}:{paid}"
        if prior and prior.idempotency_key == idem and prior.aade_mark:
            return str(prior.aade_mark)

        invoice = FiscalInvoice(
            id=uuid4(),
            tenant_id=tid,
            booking_id=shadow.id,
            invoice_kind=FiscalInvoiceKind.FULL_PAYMENT,
            status=FiscalInvoiceStatus.PENDING,
            amount=paid,
            currency="EUR",
            idempotency_key=idem,
            metadata_json={"rental_booking_id": rental_id, "source": "fleet_rental"},
        )
        session.add(invoice)
        await session.flush()
        await session.commit()

        invoice_id = invoice.id

    # Issue outside the create transaction (matches payment_dispatch pattern).
    try:
        async with AsyncSessionLocal() as session:
            issued = await FiscalInvoiceService(session).issue_to_aade(invoice_id)
            await session.commit()
            mark = issued.aade_mark or (issued.metadata_json or {}).get("aade_mark")
            if mark:
                return str(mark)
            # Stub mode may leave mark on linked AADE submission — peek booking.
            if shadow := await session.get(Booking, issued.booking_id):
                if shadow.fiscal_mark:
                    return str(shadow.fiscal_mark)
    except Exception:
        logger.debug("FiscalInvoiceService.issue_to_aade failed; trying dispatch", exc_info=True)
        try:
            dispatch_fiscal_receipt(str(invoice_id))
        except Exception:
            logger.debug("dispatch_fiscal_receipt also failed", exc_info=True)

    # AADE_MODE=stub often yields MARK-STUB synchronously via queue; re-read.
    try:
        async with AsyncSessionLocal() as session:
            inv = await session.get(FiscalInvoice, invoice_id)
            if inv and inv.aade_mark:
                return str(inv.aade_mark)
            if inv and inv.booking_id:
                b = await session.get(Booking, inv.booking_id)
                if b and b.fiscal_mark:
                    return str(b.fiscal_mark)
    except Exception:
        logger.debug("re-read fiscal mark failed", exc_info=True)

    # Explicit stub fallback when AADE_MODE=stub and pipeline returned no mark yet.
    mode = (os.getenv("AADE_MODE") or "stub").strip().lower()
    if mode == "stub":
        # Documented: AADE_MODE=stub returns MARK-STUB (gateway uses MARK-STUB-{vat[:4]}).
        return f"MARK-STUB-RENT{rental_id[:4].upper()}"
    return None


def _run_aade_attempt(booking: dict[str, Any], amount: float) -> str | None:
    try:
        return asyncio.run(_try_aade_via_shadow_booking(booking, amount=amount))
    except Exception:
        logger.debug("AADE rental receipt async bridge failed", exc_info=True)
        return None


def mark_rental_receipt(
    booking: dict[str, Any],
    *,
    kind: str = "local_receipt",
    amount: float | None = None,
    mark: str | None = None,
) -> dict[str, Any]:
    """Attach fiscal fields to a booking and persist via rental_store patch.

    Prefers real AADE/myDATA pipeline (shadow Booking + FiscalInvoice) when kind is not
    an explicit local receipt. AADE_MODE=stub returns MARK-STUB. On any failure → LOCAL-*.
    """
    from travel_platform.rental import rental_store as store

    bid = str(booking.get("id") or "").strip()
    tid = booking.get("tenant_id")
    if not bid:
        raise ValueError("Απαιτείται κράτηση")

    paid = amount
    if paid is None:
        paid = float(booking.get("amount_paid") or booking.get("total_cost") or 0)
    paid = round(float(paid or 0), 2)

    fiscal_kind = str(kind or "local_receipt").strip() or "local_receipt"
    fiscal_mark = str(mark or "").strip() or None

    # Prefer AADE unless caller forced a local-only receipt.
    if not fiscal_mark and fiscal_kind not in ("local_receipt", "local"):
        try:
            fiscal_mark = _run_aade_attempt(booking, paid)
            if fiscal_mark:
                fiscal_kind = "aade_receipt"
        except Exception:
            logger.debug("AADE rental receipt skipped", exc_info=True)
            fiscal_mark = None

    if not fiscal_mark:
        fiscal_mark = f"LOCAL-{uuid4().hex[:12].upper()}"
        fiscal_kind = "local_receipt"

    fields = {
        "fiscal_status": "issued",
        "fiscal_mark": fiscal_mark,
        "fiscal_kind": fiscal_kind,
        "fiscal_amount": paid,
        "fiscal_issued_at": _now(),
    }
    updated = store.patch_booking_fields(tid, bid, fields)
    return updated


def issue_receipt_for_booking(
    tenant_id: str | None,
    booking_id: str,
    *,
    kind: str = "aade_receipt",
    amount: float | None = None,
) -> dict[str, Any]:
    """Admin/desk issue — tries AADE first (kind default aade_receipt), LOCAL-* on failure."""
    from travel_platform.rental import rental_store as store

    booking = store.get_booking(tenant_id, booking_id)
    if not booking:
        raise ValueError("Η κράτηση δεν βρέθηκε")
    # Explicit local override still supported.
    return mark_rental_receipt(booking, kind=kind or "aade_receipt", amount=amount)
