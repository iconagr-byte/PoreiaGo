from __future__ import annotations

import secrets
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import BookingCreate, BookingResponse, GuestBookingCreate, GuestBookingLookup
from app.core.auth_deps import (
    apply_tenant_rls,
    get_client_ip,
    get_current_tenant_id,
    get_current_user_id,
    get_tenant_db,
    require_roles,
    tenant_scoped_select,
)
from app.core.database import AsyncSessionLocal
from app.models.audit import AuditAction
from app.models.booking import Booking, BookingStatus, PaymentStatus
from app.models.user import UserRole
from app.services.audit_service import AuditService

router = APIRouter(prefix="/bookings", tags=["SaaS Bookings"])


def _normalize_reference(code: str) -> str:
    c = (code or "").strip().upper().replace(" ", "")
    while c.startswith("B-") and not c.startswith("BK-"):
        c = c[2:]
    if c and not c.startswith("BK-"):
        c = f"BK-{c.removeprefix('BK-').removeprefix('BK')}"
    return c


@router.post("/lookup", response_model=BookingResponse)
async def lookup_guest_booking(body: GuestBookingLookup):
    """Public B2C — email + reference code must both match (no email-only search)."""
    ref = _normalize_reference(body.reference_code)
    email = body.passenger_email.strip().lower()
    async with AsyncSessionLocal() as db:
        await apply_tenant_rls(db, body.tenant_id)
        stmt = select(Booking).where(
            Booking.tenant_id == body.tenant_id,
            func.lower(Booking.passenger_email) == email,
            Booking.reference_code == ref,
        )
        result = await db.execute(stmt)
        booking = result.scalar_one_or_none()
        if not booking:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND,
                detail="Δεν βρέθηκε κράτηση με αυτά τα στοιχεία.",
            )
        return booking


@router.post(
    "/guest",
    response_model=BookingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_guest_booking(body: GuestBookingCreate, request: Request):
    """Public B2C checkout — requires tenant_id (from VITE_SAAS_TENANT_ID)."""
    ref = f"BK-{secrets.token_hex(4).upper()}"
    total = Decimal(str(body.total_eur if body.total_eur is not None else body.amount_eur))
    paid_now = Decimal(str(body.amount_eur))
    balance = Decimal(str(body.balance_due)) if body.balance_due is not None else max(total - paid_now, Decimal("0"))
    metadata = {
        "external_trip_id": body.external_trip_id,
        "trip_title": body.trip_title,
        "seats": body.seats or [],
        "payment_method": body.payment_method,
        "phone": body.phone,
        "source": "website_checkout",
        "payment_plan": body.payment_plan,
        "total_eur": float(total),
        "amount_paid": float(paid_now),
        "balance_due": float(balance),
        "balance_due_method": (
            "cash_on_bus"
            if balance > 0 and body.payment_method in (None, "", "cash", "cash_driver")
            else ("cash_at_office" if balance > 0 and body.payment_method == "cash_office" else None)
        ),
        "deposit_percent": int(body.deposit_percent or 30) if balance > 0 else None,
    }
    booking_status = BookingStatus.PAID
    payment_status = PaymentStatus.PAID
    if balance > 0:
        booking_status = BookingStatus.CONFIRMED
        payment_status = PaymentStatus.PARTIAL if paid_now > 0 else PaymentStatus.PENDING
    async with AsyncSessionLocal() as db:
        await apply_tenant_rls(db, body.tenant_id)
        booking = Booking(
            tenant_id=body.tenant_id,
            trip_id=None,
            customer_user_id=None,
            reference_code=ref,
            status=booking_status,
            payment_status=payment_status,
            seat_label=body.seat_label,
            passenger_name=body.passenger_name,
            passenger_email=body.passenger_email,
            total_price=total,
            amount_paid=paid_now,
            amount_eur=total,
            metadata_json=metadata,
        )
        db.add(booking)
        await db.flush()

        try:
            from app.services.aade_queue_service import AadeQueueService

            vat_base = float(body.amount_eur) / 1.24
            await AadeQueueService(db).enqueue_invoice(
                tenant_id=body.tenant_id,
                booking_id=booking.id,
                payload={
                    "amount_eur": float(body.amount_eur),
                    "vat_rate": 24.0,
                    "customer_country": "GR",
                    "line_items": [
                        {
                            "description": body.trip_title or "Εισιτήριο εκδρομής",
                            "amount": round(vat_base, 2),
                        }
                    ],
                },
                idempotency_key=f"guest-{booking.id}",
            )
        except Exception:
            pass

        await AuditService(db).record(
            tenant_id=body.tenant_id,
            actor_id=None,
            actor_email=body.passenger_email,
            action=AuditAction.CREATE,
            resource_type="booking",
            resource_id=str(booking.id),
            ip_address=await get_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
            after_state={"status": booking.status.value, "reference_code": ref, "guest": True},
        )
        await db.commit()
        await db.refresh(booking)

        try:
            from ticketing.saas_sync import upsert_ticket_booking

            meta = metadata
            trip_id = int(meta.get("external_trip_id") or 1)
            seats = meta.get("seats") or []
            seat_label = body.seat_label or (", ".join(seats) if seats else "—")
            await upsert_ticket_booking(
                local_id=f"B-{ref}",
                trip_id=trip_id,
                customer_name=body.passenger_name,
                seat_number=seat_label,
                payment_status="PAID",
                phone=body.phone,
                saas_booking_id=str(booking.id),
                email=body.passenger_email,
            )
        except Exception:
            pass

        return booking


@router.post(
    "",
    response_model=BookingResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.TENANT_ADMIN, UserRole.DISPATCHER, UserRole.CUSTOMER))],
)
async def create_booking(
    body: BookingCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_tenant_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    actor_id: Annotated[UUID, Depends(get_current_user_id)],
):
    ref = body.reference_code or f"BK-{secrets.token_hex(4).upper()}"
    amount = Decimal(str(body.amount_eur))
    booking = Booking(
        tenant_id=tenant_id,
        trip_id=body.trip_id,
        customer_user_id=actor_id,
        reference_code=ref,
        status=BookingStatus.PENDING,
        payment_status=PaymentStatus.PENDING,
        seat_label=body.seat_label,
        passenger_name=body.passenger_name,
        passenger_email=body.passenger_email,
        total_price=amount,
        amount_paid=Decimal("0"),
        amount_eur=amount,
        metadata_json=body.metadata_json,
    )
    db.add(booking)
    await db.flush()

    await AuditService(db).record(
        tenant_id=tenant_id,
        actor_id=actor_id,
        actor_email=None,
        action=AuditAction.CREATE,
        resource_type="booking",
        resource_id=str(booking.id),
        ip_address=await get_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
        after_state={"status": booking.status.value, "reference_code": ref},
    )
    return booking


@router.get(
    "",
    response_model=list[BookingResponse],
    dependencies=[Depends(require_roles(UserRole.TENANT_ADMIN, UserRole.DISPATCHER, UserRole.AUDITOR))],
)
async def list_bookings(
    db: Annotated[AsyncSession, Depends(get_tenant_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
):
    stmt = tenant_scoped_select(select(Booking), Booking, tenant_id).order_by(Booking.created_at.desc())
    result = await db.execute(stmt.limit(500))
    return list(result.scalars().all())


@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking(
    booking_id: UUID,
    db: Annotated[AsyncSession, Depends(get_tenant_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
):
    stmt = tenant_scoped_select(
        select(Booking).where(Booking.id == booking_id),
        Booking,
        tenant_id,
    )
    result = await db.execute(stmt)
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Booking not found")
    return booking
