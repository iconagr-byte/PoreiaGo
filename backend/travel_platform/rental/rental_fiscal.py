"""Lightweight fiscal receipt bridge for rental bookings (local mark v1)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def mark_rental_receipt(
    booking: dict[str, Any],
    *,
    kind: str = "local_receipt",
    amount: float | None = None,
    mark: str | None = None,
) -> dict[str, Any]:
    """Attach fiscal fields to a booking and persist via rental_store patch.

    AADE/myDATA is optional — if unavailable, uses LOCAL-{uuid} mark.
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

    # Optional AADE attempt — soft-fail to local mark.
    if not fiscal_mark and fiscal_kind not in ("local_receipt", "local"):
        try:
            # Placeholder: full AADE bridge lives elsewhere; v1 stays local.
            fiscal_mark = None
        except Exception:
            logger.debug("AADE rental receipt skipped", exc_info=True)

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
    kind: str = "local_receipt",
    amount: float | None = None,
) -> dict[str, Any]:
    from travel_platform.rental import rental_store as store

    booking = store.get_booking(tenant_id, booking_id)
    if not booking:
        raise ValueError("Η κράτηση δεν βρέθηκε")
    return mark_rental_receipt(booking, kind=kind, amount=amount)
