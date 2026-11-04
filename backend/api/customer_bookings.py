"""Customer bookings API — sync My Wallet ↔ Control Panel."""

from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from api.customer_auth import get_current_customer
from api.customer_wallet_seal import resolve_sealed_wallet_tenant
from ticketing.customer_bookings import (
    get_booking,
    list_all_bookings,
    upsert_booking,
)


def _apple_wallet_configured() -> bool:
    return bool(
        (os.getenv("APPLE_PASS_TYPE_ID") or "").strip()
        and (os.getenv("APPLE_TEAM_ID") or "").strip()
        and (os.getenv("APPLE_PASS_CERT_PEM") or os.getenv("APPLE_PASS_CERT_PATH") or "").strip()
        and (os.getenv("APPLE_PASS_KEY_PEM") or os.getenv("APPLE_PASS_KEY_PATH") or "").strip()
    )


def _google_wallet_configured() -> bool:
    return bool(
        (os.getenv("GOOGLE_WALLET_ISSUER_ID") or "").strip()
        and (os.getenv("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON") or "").strip()
    )


router = APIRouter(tags=["Customer Bookings"])


class BookingSyncRequest(BaseModel):
    bookings: list[dict[str, Any]] = Field(default_factory=list)


class BookingUpsertRequest(BaseModel):
    booking: dict[str, Any]


async def _wallet_tenant(request: Request, account: dict) -> str:
    return await resolve_sealed_wallet_tenant(
        request, jwt_tid=account.get("tenant_id")
    )


@router.get("/api/customer/bookings")
async def my_bookings(
    request: Request,
    account: dict = Depends(get_current_customer),
):
    """
    My Wallet list — Postgres (desktop) is source of truth.
    Reconciles into the sealed SQLite cache so tickets match BackOffice.
    """
    tid = await _wallet_tenant(request, account)
    from ticketing.wallet_booking_reconcile import reconcile_wallet_bookings

    items = await reconcile_wallet_bookings(
        email=account["email"],
        tenant_id=tid,
        customer_id=account.get("customer_id"),
    )
    return {
        "items": items,
        "total": len(items),
        "tenant_id": tid,
        "source": "postgres",
    }


@router.post("/api/customer/bookings/sync")
async def sync_my_bookings(
    body: BookingSyncRequest,
    request: Request,
    account: dict = Depends(get_current_customer),
):
    """
    Pull-first sync — never let localStorage invent seats over Contabo Postgres.

    Client payloads are ignored for office truth fields; we only reconcile from
    desktop bookings and return the sealed list. (Body kept for API compat.)
    """
    del body  # localStorage must not overwrite Postgres seats / passengers
    tid = await _wallet_tenant(request, account)
    from ticketing.wallet_booking_reconcile import reconcile_wallet_bookings

    items = await reconcile_wallet_bookings(
        email=account["email"],
        tenant_id=tid,
        customer_id=account.get("customer_id"),
    )
    return {
        "items": items,
        "total": len(items),
        "synced": 0,
        "tenant_id": tid,
        "source": "postgres",
    }


@router.post("/api/customer/bookings")
async def upsert_my_booking(
    body: BookingUpsertRequest,
    request: Request,
    account: dict = Depends(get_current_customer),
):
    """
    Claim / refresh one booking into the wallet cache.

    If the booking exists on desktop (Postgres), return the Postgres shape —
    client cannot change seats, passengers, payment, or status.
    """
    tid = await _wallet_tenant(request, account)
    foreign = str((body.booking or {}).get("tenant_id") or "").strip()
    if foreign and foreign != tid:
        raise HTTPException(
            status_code=403,
            detail="Η κράτηση ανήκει σε άλλο γραφείο.",
        )
    from ticketing.wallet_booking_reconcile import (
        fetch_postgres_wallet_bookings,
        reconcile_wallet_bookings,
    )

    # Always refresh office truth first.
    await reconcile_wallet_bookings(
        email=account["email"],
        tenant_id=tid,
        customer_id=account.get("customer_id"),
    )

    incoming = body.booking or {}
    aliases = {
        str(incoming.get("id") or "").strip(),
        str(incoming.get("saasBookingId") or "").strip(),
        str(incoming.get("pnr") or "").strip(),
        str(incoming.get("ticketRef") or "").strip(),
    }
    aliases = {a for a in aliases if a}

    pg_ok, pg_items = await fetch_postgres_wallet_bookings(
        email=account["email"], tenant_id=tid
    )
    if pg_ok:
        for item in pg_items:
            item_aliases = {
                str(item.get("id") or "").strip(),
                str(item.get("saasBookingId") or "").strip(),
                str(item.get("pnr") or "").strip(),
                str(item.get("ticketRef") or "").strip(),
            }
            if aliases & {a for a in item_aliases if a}:
                # Desktop wins — mirror PG row only.
                try:
                    return await upsert_booking(
                        item,
                        customer_email=account["email"],
                        customer_id=account.get("customer_id"),
                        tenant_id=tid,
                    )
                except ValueError as exc:
                    raise HTTPException(status_code=400, detail=str(exc)) from exc

        # Reconcile may already have cached it under the local B- id.
        for alias in aliases:
            cached = await get_booking(alias, tenant_id=tid)
            if cached and str(cached.get("email", "")).lower() == account["email"]:
                return cached

        # No Postgres match — refuse inventing a wallet-only booking (security).
        if aliases:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Η κράτηση δεν βρέθηκε στο γραφείο. "
                    "Το My Wallet δεν δημιουργεί εισιτήρια χωρίς εγγραφή στην πλατφόρμα."
                ),
            )

    # Postgres unreachable — never let localStorage clobber office money already
    # in the sealed cache. Prefer returning the cached row; only upsert when
    # the booking is brand-new to this wallet (offline claim of an empty slot).
    for alias in aliases:
        cached = await get_booking(alias, tenant_id=tid)
        if cached and str(cached.get("email", "")).lower() == account["email"]:
            return cached

    try:
        saved = await upsert_booking(
            incoming,
            customer_email=account["email"],
            customer_id=account.get("customer_id"),
            tenant_id=tid,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return saved


@router.get("/api/customer/bookings/{booking_id}")
async def get_my_booking(
    booking_id: str,
    request: Request,
    account: dict = Depends(get_current_customer),
):
    tid = await _wallet_tenant(request, account)
    from ticketing.wallet_booking_reconcile import reconcile_wallet_bookings

    await reconcile_wallet_bookings(
        email=account["email"],
        tenant_id=tid,
        customer_id=account.get("customer_id"),
    )
    booking = await get_booking(booking_id, tenant_id=tid)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if str(booking.get("email", "")).lower() != account["email"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    return booking


def _wallet_owns_booking(booking_row, *, email: str, cached: dict | None = None) -> bool:
    """Customer may delete bookings they own or claimed into My Wallet."""
    key = str(email or "").strip().lower()
    if not key:
        return False
    owner = str(getattr(booking_row, "passenger_email", None) or "").strip().lower()
    meta = dict(getattr(booking_row, "metadata_json", None) or {})
    wallet_email = str(meta.get("wallet_customer_email") or "").strip().lower()
    if owner == key or wallet_email == key:
        return True
    # Desk booking with empty passenger_email but wallet-sealed cache row.
    if not owner:
        cached_email = str((cached or {}).get("email") or "").strip().lower()
        return cached_email == key
    return False


@router.delete("/api/customer/bookings/{booking_id}")
async def delete_my_booking(
    booking_id: str,
    request: Request,
    account: dict = Depends(get_current_customer),
):
    """
    Permanent delete from My Wallet — removes Postgres office booking + wallet cache.

    Desktop «Κρατήσεις ανά Ταξίδι» drops the row on the next sync (poll / focus).
    """
    import logging
    from uuid import UUID

    from ticketing.customer_bookings import (
        delete_booking_by_aliases,
        delete_booking_for_customer,
        find_booking_by_aliases,
    )
    from ticketing.wallet_booking_reconcile import purge_wallet_booking_aliases

    log = logging.getLogger(__name__)
    tid = await _wallet_tenant(request, account)
    email = str(account.get("email") or "").strip().lower()
    key = str(booking_id or "").strip()
    if not key or not email:
        raise HTTPException(status_code=400, detail="Missing booking id")

    # SQLite PK is B-… while clients often send saasBookingId (UUID).
    cached = await find_booking_by_aliases([key], email=email, tenant_id=tid)
    if cached and str(cached.get("email", "")).lower() != email:
        raise HTTPException(status_code=403, detail="Forbidden")

    from api.admin_booking_mapper import booking_id_aliases, local_id_from_reference

    aliases: list[str] = []
    seen: set[str] = set()
    for raw in (
        key,
        (cached or {}).get("id"),
        (cached or {}).get("saasBookingId"),
        (cached or {}).get("pnr"),
        (cached or {}).get("ticketRef"),
        (cached or {}).get("reference_code"),
    ):
        text = str(raw or "").strip()
        if not text or text in seen:
            continue
        seen.add(text)
        aliases.append(text)
        for extra in booking_id_aliases(text):
            if extra and extra not in seen:
                seen.add(extra)
                aliases.append(extra)

    deleted_pg = False
    trip_title = str((cached or {}).get("tripTitle") or (cached or {}).get("trip_title") or "Εκδρομή")
    customer_name = str(
        (cached or {}).get("customerName")
        or (cached or {}).get("passenger_name")
        or email
    )

    try:
        tenant_uuid = UUID(str(tid))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid office seal") from exc

    pg_error: Exception | None = None
    try:
        from sqlalchemy import text

        from api.admin_booking_mapper import booking_to_admin_dict
        from api.admin_bookings_router import (
            _find_booking,
            _hard_delete_booking,
            _is_booking_id_type_mismatch,
        )
        from app.core.auth_deps import apply_tenant_rls
        from app.core.database import AsyncSessionLocal
        from ticketing.wallet_booking_reconcile import fetch_postgres_wallet_bookings

        async with AsyncSessionLocal() as db:
            await apply_tenant_rls(db, tenant_uuid)
            booking = None
            for alias in aliases:
                booking = await _find_booking(db, tenant_uuid, alias)
                if booking:
                    break
            # Fallback: scan this customer's Postgres rows (desk claim / email variants).
            if booking is None:
                pg_ok, pg_items = await fetch_postgres_wallet_bookings(
                    email=email, tenant_id=str(tid)
                )
                if pg_ok and pg_items:
                    alias_set = {a for a in aliases} | {a.upper() for a in aliases} | {
                        a.lower() for a in aliases
                    }
                    for item in pg_items:
                        candidates = {
                            str(item.get("id") or ""),
                            str(item.get("saasBookingId") or ""),
                            str(item.get("pnr") or ""),
                            str(item.get("ticketRef") or ""),
                        }
                        if candidates & alias_set:
                            saas = str(item.get("saasBookingId") or item.get("id") or "")
                            if saas:
                                booking = await _find_booking(db, tenant_uuid, saas)
                            if booking:
                                break

            if booking:
                if not _wallet_owns_booking(booking, email=email, cached=cached):
                    raise HTTPException(
                        status_code=403,
                        detail="Η κράτηση ανήκει σε άλλο λογαριασμό",
                    )
                admin_dict = booking_to_admin_dict(booking)
                trip_title = str(
                    admin_dict.get("tripTitle") or trip_title or "Εκδρομή"
                )
                customer_name = str(
                    admin_dict.get("customerName") or customer_name or email
                )
                booking_id_pg = str(booking.id)
                reference_code = str(booking.reference_code or "")
                local_id = (
                    local_id_from_reference(reference_code)
                    if reference_code
                    else booking_id_pg
                )
                for extra in (booking_id_pg, reference_code, local_id):
                    text_extra = str(extra or "").strip()
                    if text_extra and text_extra not in seen:
                        seen.add(text_extra)
                        aliases.append(text_extra)
                try:
                    await _hard_delete_booking(db, booking, tenant_uuid)
                    await db.commit()
                except Exception as exc:
                    if not _is_booking_id_type_mismatch(exc):
                        raise
                    await db.rollback()
                    await apply_tenant_rls(db, tenant_uuid)
                    await db.execute(
                        text(
                            "DELETE FROM bookings "
                            "WHERE id::text = :bid AND tenant_id::text = :tid"
                        ),
                        {"bid": booking_id_pg, "tid": str(tenant_uuid)},
                    )
                    await db.commit()
                deleted_pg = True
                try:
                    from ticketing.cancel_service import cancel_ticket_booking

                    await cancel_ticket_booking(local_id)
                    await cancel_ticket_booking(booking_id_pg)
                    if reference_code:
                        await cancel_ticket_booking(reference_code)
                except Exception:
                    log.debug("ticket cleanup after wallet delete skipped", exc_info=True)
    except HTTPException:
        raise
    except Exception as exc:
        pg_error = exc
        log.warning("wallet delete postgres failed: %s", exc, exc_info=True)

    # Always drop sealed wallet cache (and any alias rows).
    try:
        await purge_wallet_booking_aliases(
            aliases=aliases,
            email=email,
            tenant_id=str(tid),
        )
    except Exception:
        for alias in aliases:
            try:
                await delete_booking_for_customer(alias, email=email, tenant_id=str(tid))
            except Exception:
                pass
        try:
            await delete_booking_by_aliases(aliases, email=email, tenant_id=str(tid))
        except Exception:
            pass

    if not deleted_pg and not cached:
        # Nothing found — still 404 so clients can clear local dismissals.
        raise HTTPException(status_code=404, detail="Booking not found")

    if not deleted_pg and pg_error is not None:
        # Do not pretend success — reconcile would resurrect the Postgres row.
        raise HTTPException(
            status_code=503,
            detail="Αποτυχία διαγραφής κράτησης από το γραφείο — δοκιμάστε ξανά",
        ) from pg_error

    if not deleted_pg and cached:
        # Cache-only hit but Postgres still has a matching customer booking —
        # refuse success so the 20s wallet poll cannot bring it back.
        try:
            from ticketing.wallet_booking_reconcile import fetch_postgres_wallet_bookings

            pg_ok, pg_items = await fetch_postgres_wallet_bookings(
                email=email, tenant_id=str(tid)
            )
            if pg_ok:
                alias_set = {a for a in aliases} | {a.upper() for a in aliases} | {
                    a.lower() for a in aliases
                }
                still_there = False
                for item in pg_items:
                    candidates = {
                        str(item.get("id") or ""),
                        str(item.get("saasBookingId") or ""),
                        str(item.get("pnr") or ""),
                        str(item.get("ticketRef") or ""),
                    }
                    if candidates & alias_set:
                        still_there = True
                        break
                if still_there:
                    raise HTTPException(
                        status_code=503,
                        detail="Η κράτηση υπάρχει ακόμα στο γραφείο — δοκιμάστε ξανά",
                    )
        except HTTPException:
            raise
        except Exception:
            log.debug("post-delete postgres verify skipped", exc_info=True)

    # Office bell — desktop polling / WS picks this up without hard refresh.
    try:
        from travel_platform.telemetry.alerts import TelemetryAlertBus
        from travel_platform.telemetry.fleet_pubsub import publish_fleet_alert

        message = f"{customer_name} διέγραψε εισιτήριο · {trip_title}"
        alert = TelemetryAlertBus.push_generic(
            alert_type="BOOKING_DELETED",
            tenant_id=str(tid),
            message=message,
            metadata={
                "booking_id": key,
                "trip_title": trip_title,
                "customer_name": customer_name,
                "tab": "bookings",
            },
        )
        await publish_fleet_alert(
            {
                "id": alert.get("id"),
                "alert_type": "BOOKING_DELETED",
                "tenant_id": str(tid),
                "message": message,
                "created_at": alert.get("created_at"),
                "severity": "info",
                "metadata": {
                    "booking_id": key,
                    "trip_title": trip_title,
                    "tab": "bookings",
                },
            },
        )
    except Exception:
        log.debug("BOOKING_DELETED alert skipped", exc_info=True)

    return {
        "ok": True,
        "deleted": True,
        "postgres": deleted_pg,
        "id": key,
        "aliases": aliases,
    }


@router.get("/api/customer/bookings/{booking_id}/track-link")
async def get_my_booking_track_link(
    booking_id: str,
    request: Request,
    account: dict = Depends(get_current_customer),
):
    """Signed live-track URL for the passenger (map + ETA)."""
    tid = await _wallet_tenant(request, account)
    booking = await get_booking(booking_id, tenant_id=tid)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if str(booking.get("email", "")).lower() != account["email"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    from travel_platform.telemetry.passenger_track_links import (
        build_passenger_track_link,
        enrich_booking_passenger_track,
        resolve_booking_tenant_id,
        resolve_booking_trip_id,
    )

    trip_id = resolve_booking_trip_id(booking)
    if not trip_id:
        raise HTTPException(status_code=400, detail="Booking has no trip")

    enriched = enrich_booking_passenger_track(dict(booking), force=True)
    link = build_passenger_track_link(
        trip_id=trip_id,
        tenant_id=resolve_booking_tenant_id(enriched) or tid,
    )
    if not link:
        raise HTTPException(status_code=503, detail="Track link unavailable")

    await upsert_booking(
        enriched,
        customer_email=account["email"],
        customer_id=account.get("customer_id"),
        tenant_id=tid,
    )
    return {
        "trip_id": link["trip_id"],
        "tenant_id": link["tenant_id"],
        "token": link["token"],
        "path": link["path"],
        "url": link["url"],
        "expires_hours": link["expires_hours"],
    }


@router.get("/api/customer/bookings/{booking_id}/fiscal")
async def get_my_booking_fiscal(
    booking_id: str,
    request: Request,
    account: dict = Depends(get_current_customer),
):
    """Fresh fiscal MARK / receipt status from Postgres (for wallet polling)."""
    tid = await _wallet_tenant(request, account)
    cached = await get_booking(booking_id, tenant_id=tid)
    if cached and str(cached.get("email", "")).lower() != account["email"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    from app.services.customer_booking_fiscal_service import CustomerBookingFiscalService

    try:
        from uuid import UUID as _UUID

        fiscal_tid = None
        try:
            fiscal_tid = _UUID(str(tid))
        except ValueError:
            fiscal_tid = None
        fiscal = await CustomerBookingFiscalService().fetch_for_customer(
            booking_key=booking_id,
            customer_email=account["email"],
            tenant_id=fiscal_tid,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Fiscal lookup failed: {exc}") from exc

    if cached:
        merged = {**cached, **fiscal}
        await upsert_booking(
            merged,
            customer_email=account["email"],
            customer_id=account.get("customer_id"),
            tenant_id=tid,
        )
    return fiscal


@router.get("/api/customer/wallet-pass/status")
async def wallet_pass_status(account: dict = Depends(get_current_customer)):
    """Whether Apple/Google Wallet pass issuance is configured on this server."""
    _ = account
    return {
        "apple": _apple_wallet_configured(),
        "google": _google_wallet_configured(),
        "hint": (
            "Set APPLE_PASS_TYPE_ID, APPLE_TEAM_ID, APPLE_PASS_CERT_PEM/PATH, "
            "APPLE_PASS_KEY_PEM/PATH to enable .pkpass download."
        ),
    }


@router.get("/api/customer/wallet-pass/apple/{booking_id}")
async def download_apple_pass(
    booking_id: str,
    request: Request,
    account: dict = Depends(get_current_customer),
):
    """
    Download a signed Apple Wallet .pkpass when certificates are configured.

    Until certs are set, clients should use calendar/PDF fallbacks.
    """
    if not _apple_wallet_configured():
        raise HTTPException(
            status_code=501,
            detail="Apple Wallet δεν είναι ρυθμισμένο ακόμα (λείπουν certificates)",
        )

    tid = await _wallet_tenant(request, account)
    booking = await get_booking(booking_id, tenant_id=tid)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if str(booking.get("email", "")).lower() != account["email"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Placeholder for signed pass builder — wire when certs are provisioned.
    raise HTTPException(
        status_code=501,
        detail="Apple Wallet builder θα ενεργοποιηθεί μόλις φορτωθούν τα certificates",
    )


@router.get("/api/bookings")
async def list_bookings_admin(request: Request):
    """Όλες οι κρατήσεις — Control Panel (requires admin JWT; never public)."""
    from middleware.tenant import ADMIN_ACCESS_ROLES, _jwt_settings
    import jwt as pyjwt

    secret, algorithm, admin_disabled = _jwt_settings()
    if admin_disabled:
        items = await list_all_bookings()
        return {"items": items, "total": len(items)}
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        payload = pyjwt.decode(auth[7:].strip(), secret, algorithms=[algorithm])
    except pyjwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc
    roles = set(payload.get("roles") or [])
    if not roles & ADMIN_ACCESS_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    # Prefer Postgres admin bookings for tenant-scoped offices; SQLite dump is
    # only for superadmin (legacy demo). Office admins get empty here — use
    # /api/admin/platform/bookings instead.
    if "superadmin" not in roles:
        raise HTTPException(
            status_code=403,
            detail="Χρησιμοποιήστε /api/admin/platform/bookings για κρατήσεις γραφείου",
        )
    items = await list_all_bookings()
    return {"items": items, "total": len(items)}
