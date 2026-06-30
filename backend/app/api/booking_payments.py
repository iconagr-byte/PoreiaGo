"""Admin + staff endpoints for recording manual cash payments."""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_deps import (
    apply_tenant_rls,
    get_current_tenant_id,
    get_current_user_id,
    get_tenant_db,
    require_roles,
)
from app.core.database import AsyncSessionLocal
from app.models.user import UserRole
from app.services.booking_payment_service import BookingPaymentService
from app.services.payment_dispatch import dispatch_fiscal_issuance
from travel_platform.payments.cash_payment_confirm import (
    CashPaymentChannel,
    build_cash_payment_patch,
    record_cash_audit,
    validate_cash_payment_request,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bookings", tags=["SaaS Booking Payments"])


class CashPaymentRequest(BaseModel):
    amount: float = Field(gt=0, description="Ποσό μετρητών που παραλήφθηκε")
    channel: Literal["office_counter", "driver_on_bus"] = Field(
        description="office_counter = γκισέ · driver_on_bus = οδηγός/λεωφορείο",
    )
    reference_code: str | None = Field(default=None, description="Επιβεβαίωση PNR (προαιρετικό)")
    receipt_number: str | None = Field(default=None, max_length=64)
    note: str | None = Field(default=None, max_length=500)
    idempotency_key: str | None = Field(default=None, max_length=128)


class CashPaymentResponse(BaseModel):
    status: str
    booking_id: UUID
    amount_captured: float
    payment_status: str
    balance_due: float
    fiscal_invoice_id: UUID | None = None
    channel: str


async def _sync_booking_cache(admin_dict: dict) -> None:
    try:
        from ticketing.customer_bookings import upsert_booking

        email = admin_dict.get("email") or "unknown@local.invalid"
        await upsert_booking(admin_dict, customer_email=email)
    except Exception:
        pass


@router.post(
    "/{booking_id}/cash-payment",
    response_model=CashPaymentResponse,
    dependencies=[Depends(require_roles(UserRole.TENANT_ADMIN, UserRole.DISPATCHER))],
)
async def record_cash_payment_saas(
    booking_id: UUID,
    body: CashPaymentRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_tenant_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    actor_id: Annotated[UUID, Depends(get_current_user_id)],
):
    """Καταχώρηση μετρητών από γραφείο ή οδηγό — με αυτόματη απόδειξη myDATA."""
    from api.admin_booking_mapper import booking_to_admin_dict
    from api.admin_bookings_router import _find_booking

    pg_booking = await _find_booking(db, tenant_id, str(booking_id))
    if not pg_booking:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Booking not found")

    admin_view = booking_to_admin_dict(pg_booking)
    try:
        channel = validate_cash_payment_request(admin_view, body.model_dump())
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    fiscal_invoice_id: UUID | None = None
    try:
        result = await BookingPaymentService(db).record_cash_payment(
            tenant_id=tenant_id,
            booking_id=pg_booking.id,
            amount=Decimal(str(body.amount)),
            channel=channel,
            idempotency_key=body.idempotency_key,
            actor_id=str(actor_id),
            note=body.note,
            receipt_number=body.receipt_number,
        )
        await db.commit()
        await db.refresh(pg_booking)
        fiscal_invoice_id = result.fiscal_invoice_id
    except Exception as exc:
        await db.rollback()
        logger.exception("Cash payment failed booking=%s", booking_id)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Cash payment failed") from exc

    if fiscal_invoice_id and result.status == "captured":
        dispatch_fiscal_issuance(str(fiscal_invoice_id))

    admin_view = booking_to_admin_dict(pg_booking)
    balance = float(max(pg_booking.total_price - pg_booking.amount_paid, Decimal("0")))
    patch = build_cash_payment_patch(
        admin_view,
        channel=channel,
        amount_paid_now=float(body.amount),
        new_amount_paid=float(pg_booking.amount_paid),
        new_balance=balance,
        note=body.note,
        receipt_number=body.receipt_number,
    )
    merged = {**admin_view, **patch}
    await _sync_booking_cache(merged)

    record_cash_audit(
        booking_id=str(pg_booking.id),
        amount_eur=float(body.amount),
        channel=channel,
        actor_id=str(actor_id),
        reference=body.reference_code,
        detail=body.note,
        receipt_number=body.receipt_number,
    )

    try:
        from ticketing.payment_confirmation_email import (
            EVENT_CASH_PAYMENT,
            send_payment_confirmation_notifications,
        )

        await send_payment_confirmation_notifications(merged, event=EVENT_CASH_PAYMENT)
    except Exception:
        pass

    return CashPaymentResponse(
        status=result.status,
        booking_id=pg_booking.id,
        amount_captured=float(result.amount_captured or 0),
        payment_status=pg_booking.payment_status.value,
        balance_due=balance,
        fiscal_invoice_id=fiscal_invoice_id,
        channel=channel.value,
    )
