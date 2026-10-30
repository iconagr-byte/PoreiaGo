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
