from __future__ import annotations

import asyncio
import logging
import secrets
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

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


def _safe_audit_ip(raw: str | None) -> str | None:
    """AuditLog.ip_address is INET — reject garbage (proxies sometimes send hostnames)."""
    if not raw:
        return None
    ip = str(raw).strip().split("%")[0]  # strip IPv6 zone id
    if not ip or ip.lower() in {"unknown", "null", "undefined"}:
        return None
    # IPv4
    if ip.count(".") == 3:
        parts = ip.split(".")
        if all(p.isdigit() and 0 <= int(p) <= 255 for p in parts):
            return ip
        return None
    # IPv6 (very light — letters only a-f)
    if ":" in ip:
        cleaned = ip.replace(":", "")
        if cleaned and all(c in "0123456789abcdefABCDEF" for c in cleaned):
            return ip[:64]
        return None
    return None


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


async def _guest_booking_side_effects(
    *,
    booking_snapshot: dict,
    tenant_id: str,
    ref: str,
    paid_now: float,
    total: float,
    trip_title: str | None,
    passenger_name: str,
    passenger_email: str | None,
    passenger_phone: str | None,
    source: str,
    seat_label: str,
    requested_seats: list[str],
    metadata: dict,
    client_ip: str | None,
    user_agent: str | None,
    mint_wallet_token: bool,
) -> None:
    """AADE / audit / ticket sync / office email / bell — never blocks the 201 response."""
    tid = UUID(str(tenant_id))
    if mint_wallet_token and passenger_email:
        try:
            from ticketing.wallet_magic import create_wallet_magic_token

            await create_wallet_magic_token(
                email=passenger_email,
                booking_id=str(booking_snapshot["id"]),
                name=passenger_name,
                phone=passenger_phone,
            )
        except Exception as magic_exc:
            logger.warning(
                "Guest booking wallet magic skipped ref=%s: %s",
                ref,
                magic_exc,
            )

    if paid_now > 0:
        try:
            async with AsyncSessionLocal() as aade_db:
                from app.services.aade_queue_service import AadeQueueService

                vat_base = float(paid_now) / 1.24
                await AadeQueueService(aade_db).enqueue_invoice(
                    tenant_id=tid,
                    booking_id=UUID(str(booking_snapshot["id"])),
                    payload={
                        "amount_eur": float(paid_now),
                        "vat_rate": 24.0,
                        "customer_country": "GR",
                        "line_items": [
                            {
                                "description": trip_title or "Εισιτήριο εκδρομής",
                                "amount": round(vat_base, 2),
                            }
                        ],
                    },
                    idempotency_key=f"guest-{booking_snapshot['id']}",
                )
                await aade_db.commit()
        except Exception as aade_exc:
            logger.warning(
                "Guest booking AADE enqueue skipped ref=%s: %s",
                ref,
                aade_exc,
            )

    try:
        async with AsyncSessionLocal() as audit_db:
            from app.services.ensure_audit_logs_schema import ensure_audit_logs_schema

            try:
                await ensure_audit_logs_schema(audit_db)
            except Exception:
                pass
            await AuditService(audit_db).record(
                tenant_id=tid,
                actor_id=None,
                actor_email=passenger_email,
                action=AuditAction.CREATE,
                resource_type="booking",
                resource_id=str(booking_snapshot["id"]),
                ip_address=_safe_audit_ip(client_ip),
                user_agent=(user_agent or "")[:512] or None,
                after_state={
                    "status": booking_snapshot["status"],
                    "reference_code": ref,
                    "guest": True,
                    "source": source,
                },
            )
            await audit_db.commit()
    except Exception as audit_exc:
        logger.warning(
            "Guest booking audit skipped ref=%s tenant=%s: %s",
            ref,
            tenant_id,
            audit_exc,
        )

    try:
        from api.admin_booking_mapper import local_id_from_reference
        from ticketing.saas_sync import upsert_ticket_booking

        meta = metadata or {}
        raw_tid = meta.get("external_trip_id") or meta.get("trip_id")
        try:
            trip_id = int(raw_tid) if raw_tid is not None else 0
        except (TypeError, ValueError):
            trip_id = 0
        if trip_id <= 0:
            raise ValueError("missing external_trip_id for ticket sync")
        seats = meta.get("seats") or requested_seats or []
        ticket_seat = seat_label or (", ".join(seats) if seats else "—")
        ticket_pay = (
            "PAID"
            if paid_now >= total and total > 0
            else ("DEPOSIT" if paid_now > 0 else "PENDING")
        )
        await upsert_ticket_booking(
            local_id=local_id_from_reference(ref),
            trip_id=trip_id,
            customer_name=passenger_name,
            seat_number=ticket_seat,
            payment_status=ticket_pay,
            phone=passenger_phone,
            saas_booking_id=str(booking_snapshot["id"]),
            email=passenger_email,
            special_requirements={
                "passengers": meta.get("passengers") or [],
            }
            if meta.get("passengers")
            else None,
        )
    except Exception:
        pass

    # Always notify the office on every new guest booking (paid or unpaid hold).
    # Prefer tenant Email Hub SMTP so Achillio mail lands in the office mailbox.
    notify_payload = {
        "id": str(booking_snapshot["id"]),
        "pnr": booking_snapshot["reference_code"],
        "reference_code": booking_snapshot["reference_code"],
        "tenant_id": str(tenant_id),
        "customerName": passenger_name,
        "passenger_name": passenger_name,
        "email": passenger_email,
        "phone": passenger_phone,
        "tripTitle": (trip_title or "").strip() or "Εκδρομή",
        "trip_title": (trip_title or "").strip() or "Εκδρομή",
        "seat": seat_label,
        "seat_label": seat_label,
        "seats": requested_seats,
        "amountPaid": float(paid_now),
        "amount_paid": float(paid_now),
        "price": float(total),
        "balanceDue": max(float(total) - float(paid_now), 0.0),
        "metadata_json": booking_snapshot.get("metadata_json") or {},
        "status": "Επιβεβαιωμένη" if paid_now > 0 else "Εκκρεμής",
        "paymentStatus": "PAID" if paid_now >= total and total > 0 else ("DEPOSIT" if paid_now > 0 else "PENDING"),
    }
    try:
        from ticketing.payment_confirmation_email import (
            EVENT_NEW_BOOKING,
            EVENT_ONLINE_DEPOSIT,
            EVENT_ONLINE_FULL,
            send_payment_confirmation_notifications,
        )

        if paid_now <= 0:
            notify_event = EVENT_NEW_BOOKING
        elif paid_now < total:
            notify_event = EVENT_ONLINE_DEPOSIT
        else:
            notify_event = EVENT_ONLINE_FULL
        await send_payment_confirmation_notifications(
            notify_payload,
            event=notify_event,
            require_office=True,
            notify_customer=paid_now > 0,
        )
    except Exception as exc:
        logger.error(
            "Guest booking office payment email failed ref=%s tenant=%s: %s",
            ref,
            tenant_id,
            exc,
        )

    try:
        from travel_platform.notifications.excursion_booking_push import (
            notify_excursion_booking_to_office,
        )

        push_payload = dict(notify_payload)
        push_payload.setdefault("tenant_id", str(tenant_id))
        await notify_excursion_booking_to_office(push_payload)
    except Exception as exc:
        logger.warning(
            "Guest booking office bell/push failed ref=%s tenant=%s: %s",
            ref,
            tenant_id,
            exc,
        )


def _json_safe(value):
    """Coerce booking payloads for JSONResponse (Decimal/UUID never leak)."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(v) for v in value]
    if hasattr(value, "value"):
        return _json_safe(getattr(value, "value"))
    return str(value)


def _booking_row_snapshot(row: Booking) -> dict:
    """Plain JSON-safe dict — never return ORM instances to the ASGI layer."""
    status_v = row.status.value if hasattr(row.status, "value") else str(row.status)
    pay_v = (
        row.payment_status.value
        if hasattr(row.payment_status, "value")
        else str(row.payment_status)
    )
    return {
        "id": str(row.id),
        "tenant_id": str(row.tenant_id),
        "reference_code": str(row.reference_code),
        "status": str(status_v),
        "payment_status": str(pay_v),
        "total_price": float(row.total_price or 0),
        "amount_paid": float(row.amount_paid or 0),
        "amount_eur": float(row.amount_eur or 0),
        "passenger_name": row.passenger_name,
        "passenger_email": row.passenger_email,
        "seat_label": row.seat_label,
        "metadata_json": _json_safe(dict(row.metadata_json or {})),
    }


def _schedule_guest_booking_side_effects(**kwargs) -> None:
    """Fire-and-forget notify work.

    Do **not** use FastAPI BackgroundTasks here: uvicorn awaits them before the
    ASGI cycle ends, so slow SMTP (office + customer mail) exceeds the edge
    proxy read timeout and the client sees text/plain 500 after a durable insert.

    Yield once before notify so the 201 can flush past BaseHTTPMiddleware /
    OpenResty before SMTP starts.
    """

    async def _run() -> None:
        try:
            await asyncio.sleep(0)
            await _guest_booking_side_effects(**kwargs)
        except Exception as exc:
            logger.exception(
                "Guest booking side-effects crashed ref=%s: %s",
                kwargs.get("ref"),
                exc,
            )

    try:
        asyncio.get_running_loop().create_task(_run())
    except RuntimeError:
        logger.warning(
            "Guest booking side-effects not scheduled (no running loop) ref=%s",
            kwargs.get("ref"),
        )


@router.post(
    "/guest",
    status_code=status.HTTP_201_CREATED,
)
async def create_guest_booking(
    body: GuestBookingCreate,
    request: Request,
):
    """Public B2C / office checkout — tenant from Host when possible; body.tenant_id must match.

    Optional My Wallet Bearer JWT stamps the booking with the logged-in account so
    the office sees who booked without the customer re-entering identity.

    Guest B2C checkouts (no Bearer) get a one-shot ``wallet_activate_token`` so the
    storefront can open My Wallet immediately after payment without a password.
    """
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

    # Optional My Wallet session — never trust body alone for account linkage.
    wallet_email: str | None = None
    wallet_customer_id: str | None = None
    auth = request.headers.get("Authorization") or ""
    if auth.startswith("Bearer "):
        try:
            from ticketing.customer_jwt import decode_customer_token

            payload = decode_customer_token(auth[7:].strip())
            wallet_email = str(payload.get("sub") or "").strip().lower() or None
            wallet_customer_id = str(payload.get("customer_id") or "").strip() or None
        except Exception:
            wallet_email = None
            wallet_customer_id = None

    passenger_email = (wallet_email or (body.passenger_email or "")).strip().lower()
    passenger_name = (body.passenger_name or "").strip()
    passenger_phone = (body.phone or "").strip() or None

    # Always store int for office manifest / occupied-seats matching (91001 etc.).
    external_trip_id: int | None = None
    if body.external_trip_id is not None:
        try:
            external_trip_id = int(body.external_trip_id)
        except (TypeError, ValueError):
            external_trip_id = None

    metadata = {
        "external_trip_id": external_trip_id,
        "trip_title": body.trip_title,
        "seats": requested_seats,
        "payment_method": pay_method,
        "phone": passenger_phone,
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
        "account_linked": bool(wallet_email),
        "wallet_customer_email": wallet_email,
        "wallet_customer_id": wallet_customer_id,
    }
    if body.passengers:
        metadata["passengers"] = body.passengers
    booking_status = BookingStatus.PAID
    payment_status = PaymentStatus.PAID
    if balance > 0:
        booking_status = BookingStatus.CONFIRMED
        payment_status = PaymentStatus.PARTIAL if paid_now > 0 else PaymentStatus.PENDING
    elif paid_now <= 0:
        booking_status = BookingStatus.CONFIRMED
        payment_status = PaymentStatus.PENDING

    async def _persist_guest_booking(db, *, heal: bool = False):
        """Persist booking only — AADE/audit run post-commit (never poison this txn)."""
        from app.services.ensure_bookings_schema import ensure_bookings_schema

        if heal:
            await ensure_bookings_schema(db, force=True)
        else:
            await ensure_bookings_schema(db)

        await apply_tenant_rls(db, tenant_id)
        if external_trip_id is not None and requested_seats:
            occupied = await load_occupied_seats_for_trip(
                db,
                tenant_id=tenant_id,
                external_trip_id=external_trip_id,
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
        row = Booking(
            tenant_id=tenant_id,
            # Contabo office trips use integer ids (91001) — also keep in metadata.
            trip_id=external_trip_id,
            customer_user_id=None,
            reference_code=ref,
            status=booking_status,
            payment_status=payment_status,
            seat_label=seat_label,
            passenger_name=passenger_name,
            passenger_email=passenger_email,
            total_price=total,
            amount_paid=paid_now,
            amount_eur=total,
            metadata_json=metadata,
        )
        db.add(row)
        await db.flush()

        meta = dict(metadata)
        meta["transaction_id"] = f"TXN-{row.id}"
        meta["invoice_number"] = f"INV-{ref.replace('BK-', '')}"
        if paid_now > 0:
            from datetime import datetime, timezone

            meta["payment_date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        row.metadata_json = meta
        metadata.clear()
        metadata.update(meta)

        # Commit κρατηση alone. AADE + audit_logs must NOT share this transaction:
        # a failed flush (schema/INET/queue) aborts Postgres and would roll back the booking.
        # Snapshot primitives BEFORE commit/close — never touch ORM after durable insert.
        snap = _booking_row_snapshot(row)
        await db.commit()
        return snap

    async def _load_booking_snap_by_ref(db) -> dict | None:
        await apply_tenant_rls(db, tenant_id)
        loaded = await db.scalar(
            select(Booking).where(
                Booking.tenant_id == tenant_id,
                Booking.reference_code == ref,
            )
        )
        return _booking_row_snapshot(loaded) if loaded is not None else None

    booking_snapshot: dict | None = None
    async with AsyncSessionLocal() as db:
        try:
            booking_snapshot = await _persist_guest_booking(db, heal=False)
        except HTTPException:
            await db.rollback()
            # If a prior attempt already committed this ref, return it (not 409).
            try:
                booking_snapshot = await _load_booking_snap_by_ref(db)
            except Exception:
                booking_snapshot = None
            if booking_snapshot is None:
                raise
        except Exception as exc:
            await db.rollback()
            from app.services.ensure_bookings_schema import is_bookings_schema_drift_error

            # Prefer already-committed row (refresh/post-commit glitch) over re-insert.
            try:
                booking_snapshot = await _load_booking_snap_by_ref(db)
            except Exception:
                booking_snapshot = None
            if booking_snapshot is not None:
                logger.warning(
                    "Guest booking recovered committed ref=%s after persist error: %s",
                    ref,
                    exc,
                )
            elif is_bookings_schema_drift_error(exc):
                try:
                    booking_snapshot = await _persist_guest_booking(db, heal=True)
                except HTTPException as http_exc:
                    await db.rollback()
                    try:
                        booking_snapshot = await _load_booking_snap_by_ref(db)
                    except Exception:
                        booking_snapshot = None
                    if booking_snapshot is None:
                        raise http_exc
                except Exception as retry_exc:
                    await db.rollback()
                    try:
                        booking_snapshot = await _load_booking_snap_by_ref(db)
                    except Exception:
                        booking_snapshot = None
                    if booking_snapshot is None:
                        logger.exception(
                            "Guest booking retry after schema heal failed tenant=%s",
                            tenant_id,
                        )
                        raise HTTPException(
                            status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=(
                                "Αποτυχία καταχώρησης κράτησης μετά από επισκευή σχήματος: "
                                f"{retry_exc.__class__.__name__}: {retry_exc}"
                            ),
                        ) from retry_exc
            else:
                logger.exception(
                    "Guest booking persist failed tenant=%s ref=%s",
                    tenant_id,
                    ref,
                )
                raise HTTPException(
                    status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=(
                        "Αποτυχία καταχώρησης κράτησης: "
                        f"{exc.__class__.__name__}: {exc}"
                    ),
                ) from exc

    if not booking_snapshot:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Αποτυχία καταχώρησης κράτησης: empty booking",
        )

    # From here the κρατηση is durable. Never raise — client must see 201.
    payload = {
        "id": booking_snapshot["id"],
        "tenant_id": booking_snapshot["tenant_id"],
        "reference_code": booking_snapshot["reference_code"],
        "status": booking_snapshot["status"],
        "payment_status": booking_snapshot["payment_status"],
        "total_price": booking_snapshot["total_price"],
        "amount_paid": booking_snapshot["amount_paid"],
        "amount_eur": booking_snapshot["amount_eur"],
        "passenger_name": booking_snapshot.get("passenger_name"),
        "passenger_email": booking_snapshot.get("passenger_email"),
        "seat_label": booking_snapshot.get("seat_label"),
        "metadata_json": booking_snapshot.get("metadata_json") or {},
        "wallet_activate_token": None,
    }
    try:
        src_l = source.lower()
        is_office_desk = (
            "office" in src_l
            or "walk-in" in src_l
            or "walk_in" in src_l
            or "desk" in src_l
            or "γκισέ" in src_l
        )
        mint_wallet_token = bool(
            (not wallet_email) and passenger_email and (not is_office_desk)
        )
        try:
            client_ip = await get_client_ip(request)
        except Exception:
            client_ip = None
        user_agent = request.headers.get("User-Agent")
        _schedule_guest_booking_side_effects(
            booking_snapshot={
                "id": payload["id"],
                "reference_code": payload["reference_code"],
                "status": payload["status"],
                "metadata_json": payload["metadata_json"],
            },
            tenant_id=str(tenant_id),
            ref=ref,
            paid_now=float(paid_now),
            total=float(total),
            trip_title=(body.trip_title or "").strip() or None,
            passenger_name=passenger_name,
            passenger_email=passenger_email,
            passenger_phone=passenger_phone,
            source=source,
            seat_label=seat_label or "",
            requested_seats=list(requested_seats),
            metadata=_json_safe(dict(metadata or {})),
            client_ip=client_ip,
            user_agent=user_agent,
            mint_wallet_token=mint_wallet_token,
        )
    except Exception as sched_exc:
        logger.exception(
            "Guest booking notify schedule failed ref=%s (still returning 201): %s",
            ref,
            sched_exc,
        )

    try:
        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content=_json_safe(payload),
        )
    except Exception as resp_exc:
        logger.exception(
            "Guest booking JSONResponse failed ref=%s — minimal 201: %s",
            ref,
            resp_exc,
        )
        from starlette.responses import Response

        import json as _json

        return Response(
            content=_json.dumps(
                {
                    "id": payload.get("id"),
                    "tenant_id": str(tenant_id),
                    "reference_code": ref,
                    "status": payload.get("status") or "paid",
                    "payment_status": payload.get("payment_status") or "paid",
                    "total_price": float(total),
                    "amount_paid": float(paid_now),
                    "amount_eur": float(total),
                    "wallet_activate_token": None,
                }
            ),
            status_code=201,
            media_type="application/json",
        )


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
