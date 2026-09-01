from __future__ import annotations

import secrets
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import (
    BookingCreate,
    BookingResponse,
    GuestBookingCreate,
    GuestBookingLookup,
    OccupiedSeatsResponse,
)
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
from app.services.seat_occupancy import (
    conflicting_seats,
    load_occupied_seats_for_trip,
    normalize_seat_code,
)

router = APIRouter(prefix="/bookings", tags=["SaaS Bookings"])


def _normalize_reference(code: str) -> str:
    c = (code or "").strip().upper().replace(" ", "")
    while c.startswith("B-") and not c.startswith("BK-"):
        c = c[2:]
    if c and not c.startswith("BK-"):
        c = f"BK-{c.removeprefix('BK-').removeprefix('BK')}"
    return c


async def _resolve_guest_tenant(request: Request, body_tenant_id: UUID | None) -> UUID:
    """
    Bind public checkout/lookup to the office Host when resolvable.
    body.tenant_id may only be used on platform hosts, or must match Host tenant.
    """
    host = (
        request.headers.get("x-forwarded-host")
        or request.headers.get("host")
        or ""
    ).split(",")[0].strip().split(":")[0].strip().lower()

    resolved_id: UUID | None = None
    try:
        from olympus.tenant.domain_resolver import DomainResolver

        async with AsyncSessionLocal() as session:
            resolved = await DomainResolver(session).resolve(host)
            if resolved:
                resolved_id = resolved.tenant_id
    except Exception:
        resolved_id = None

    # Also honor middleware DomainTenant when present.
    state_tid = getattr(request.state, "tenant_id", None)
    if state_tid is not None and resolved_id is None:
        try:
            resolved_id = UUID(str(state_tid))
        except ValueError:
            resolved_id = None

    if resolved_id is not None:
        if body_tenant_id is not None and str(body_tenant_id) != str(resolved_id):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Το tenant_id δεν ταιριάζει με το domain του γραφείου.",
            )
        return resolved_id

    if body_tenant_id is not None:
        return body_tenant_id

    raise HTTPException(
        status.HTTP_400_BAD_REQUEST,
        detail="Δεν βρέθηκε γραφείο για αυτό το domain — δοκιμάστε ξανά από το site του γραφείου.",
    )


@router.post("/lookup", response_model=BookingResponse)
async def lookup_guest_booking(body: GuestBookingLookup, request: Request):
    """Public B2C — email + reference code must both match (no email-only search)."""
    ref = _normalize_reference(body.reference_code)
    email = body.passenger_email.strip().lower()
    tenant_id = await _resolve_guest_tenant(request, body.tenant_id)
    async with AsyncSessionLocal() as db:
        await apply_tenant_rls(db, tenant_id)
        stmt = select(Booking).where(
            Booking.tenant_id == tenant_id,
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


@router.get("/occupied-seats", response_model=OccupiedSeatsResponse)
async def get_occupied_seats(
    request: Request,
    external_trip_id: int,
    tenant_id: UUID | None = None,
):
    """Public B2C seat map — returns occupied seat codes only (no passenger data)."""
    tid = await _resolve_guest_tenant(request, tenant_id)
    async with AsyncSessionLocal() as db:
        await apply_tenant_rls(db, tid)
        taken = await load_occupied_seats_for_trip(
            db,
            tenant_id=tid,
            external_trip_id=external_trip_id,
        )
    seats = sorted(taken)
    return OccupiedSeatsResponse(
        external_trip_id=external_trip_id,
        seats=seats,
        count=len(seats),
    )


@router.post(
    "/guest",
    response_model=BookingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_guest_booking(body: GuestBookingCreate, request: Request):
    """Public B2C / office checkout — tenant from Host when possible; body.tenant_id must match."""
    tenant_id = await _resolve_guest_tenant(request, body.tenant_id)
    ref = f"BK-{secrets.token_hex(4).upper()}"
    total = Decimal(str(body.total_eur if body.total_eur is not None else body.amount_eur))
    paid_now = Decimal(str(body.amount_eur))
    balance = Decimal(str(body.balance_due)) if body.balance_due is not None else max(total - paid_now, Decimal("0"))
    requested_seats = [
        normalize_seat_code(s)
        for s in (body.seats or [])
        if normalize_seat_code(s)
    ]
    if not requested_seats and body.seat_label:
        requested_seats = [
            normalize_seat_code(part)
            for part in str(body.seat_label).split(",")
            if normalize_seat_code(part)
        ]
    seat_label = body.seat_label or (", ".join(requested_seats) if requested_seats else None)
    if seat_label and len(seat_label) > 128:
        seat_label = seat_label[:128]

    taxes = round(float(total) * 0.24, 2)
    base_price = round(float(total) - taxes, 2)
    source = (body.source or "website_checkout").strip() or "website_checkout"
    agent_name = (body.agent_name or "").strip() or None
    pay_method = body.payment_method
    if balance > 0 and pay_method in (None, "", "cash", "cash_driver", "cash_on_bus"):
        balance_method = "cash_on_bus"
    elif balance > 0 and pay_method in ("cash_office", "cash_at_office"):
        balance_method = "cash_at_office"
    else:
        balance_method = None

    if paid_now <= 0 and balance > 0:
        if pay_method in ("cash_on_bus", "cash", "cash_driver"):
            payment_status_label = "PENDING (Μετρητά στο λεωφορείο)"
        elif pay_method in ("cash_office", "cash_at_office"):
            payment_status_label = "PENDING (Μετρητά — γκισέ)"
        else:
            payment_status_label = "PENDING"
    elif balance > 0:
        payment_status_label = f"DEPOSIT {int(body.deposit_percent or 30)}% (Online)"
    elif pay_method in ("cash_office", "cash_at_office", "cash_on_bus", "cash", "cash_driver"):
        payment_status_label = "PAID (Μετρητά — γκισέ)" if "office" in str(pay_method) else "PAID (Μετρητά)"
    else:
        payment_status_label = "PAID (SaaS)"

    metadata = {
        "external_trip_id": body.external_trip_id,
        "trip_title": body.trip_title,
        "seats": requested_seats,
        "payment_method": pay_method,
        "phone": body.phone,
        "source": source,
        "agent_name": agent_name,
        "departure_at": body.departure_at,
        "payment_plan": body.payment_plan,
        "total_eur": float(total),
        "amount_paid": float(paid_now),
        "balance_due": float(balance),
        "balance_due_method": balance_method,
        "deposit_percent": int(body.deposit_percent or 30) if balance > 0 else None,
        "base_price": base_price,
        "taxes": taxes,
        "payment_status": payment_status_label,
        "boarding_pass_issued": True,
        "ticket_ref": ref,
    }
    booking_status = BookingStatus.PAID
    payment_status = PaymentStatus.PAID
    if balance > 0:
        booking_status = BookingStatus.CONFIRMED
        payment_status = PaymentStatus.PARTIAL if paid_now > 0 else PaymentStatus.PENDING
    elif paid_now <= 0:
        booking_status = BookingStatus.CONFIRMED
        payment_status = PaymentStatus.PENDING

    async with AsyncSessionLocal() as db:
        await apply_tenant_rls(db, tenant_id)
        if body.external_trip_id is not None and requested_seats:
            occupied = await load_occupied_seats_for_trip(
                db,
                tenant_id=tenant_id,
                external_trip_id=int(body.external_trip_id),
                for_update=True,
            )
            clashes = conflicting_seats(requested_seats, occupied)
            if clashes:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    detail={
                        "message": f"Οι θέσεις είναι ήδη κατειλημμένες: {', '.join(clashes)}",
                        "code": "seat_conflict",
                        "seats": clashes,
                    },
                )
        booking = Booking(
            tenant_id=tenant_id,
            trip_id=None,
            customer_user_id=None,
            reference_code=ref,
            status=booking_status,
            payment_status=payment_status,
            seat_label=seat_label,
            passenger_name=body.passenger_name,
            passenger_email=body.passenger_email,
            total_price=total,
            amount_paid=paid_now,
            amount_eur=total,
            metadata_json=metadata,
        )
        db.add(booking)
        await db.flush()

        metadata["transaction_id"] = f"TXN-{booking.id}"
        metadata["invoice_number"] = f"INV-{ref.replace('BK-', '')}"
        if paid_now > 0:
            from datetime import datetime, timezone

            metadata["payment_date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        booking.metadata_json = dict(metadata)

        if paid_now > 0:
            try:
                from app.services.aade_queue_service import AadeQueueService

                vat_base = float(paid_now) / 1.24
                await AadeQueueService(db).enqueue_invoice(
                    tenant_id=tenant_id,
                    booking_id=booking.id,
                    payload={
                        "amount_eur": float(paid_now),
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
            tenant_id=tenant_id,
            actor_id=None,
            actor_email=body.passenger_email,
            action=AuditAction.CREATE,
            resource_type="booking",
            resource_id=str(booking.id),
            ip_address=await get_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
            after_state={"status": booking.status.value, "reference_code": ref, "guest": True, "source": source},
        )
        await db.commit()
        await db.refresh(booking)

        try:
            from api.admin_booking_mapper import local_id_from_reference
            from ticketing.saas_sync import upsert_ticket_booking

            meta = metadata
            trip_id = int(meta.get("external_trip_id") or 1)
            seats = meta.get("seats") or []
            ticket_seat = seat_label or (", ".join(seats) if seats else "—")
            ticket_pay = (
                "PAID"
                if paid_now >= total and total > 0
                else ("DEPOSIT" if paid_now > 0 else "PENDING")
            )
            await upsert_ticket_booking(
                local_id=local_id_from_reference(ref),
                trip_id=trip_id,
                customer_name=body.passenger_name,
                seat_number=ticket_seat,
                payment_status=ticket_pay,
                phone=body.phone,
                saas_booking_id=str(booking.id),
                email=body.passenger_email,
            )
        except Exception:
            pass

        # My Wallet SQLite — so the passenger sees the ticket when they log in
        # with the same email (no manual booking-code claim required).
        try:
            from app.services.customer_wallet_booking_sync import mirror_single_booking_to_wallet

            await mirror_single_booking_to_wallet(booking, tenant_id=str(tenant_id))
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
