"""
Wallet ↔ desktop booking sync — Postgres is the office source of truth.

SQLite ``customer_bookings`` is a sealed per-office cache for My Wallet.
Client localStorage must never invent seats/passengers over Contabo Postgres.
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, select

logger = logging.getLogger(__name__)


def _booking_aliases(row: dict[str, Any]) -> set[str]:
    out: set[str] = set()
    for key in ("id", "saasBookingId", "pnr", "ticketRef", "reference_code", "ticket_ref"):
        raw = row.get(key)
        if raw is None:
            continue
        text = str(raw).strip()
        if text:
            out.add(text)
            out.add(text.upper())
            out.add(text.lower())
    return out


async def fetch_postgres_wallet_bookings(
    *,
    email: str,
    tenant_id: str,
) -> tuple[bool, list[dict[str, Any]]]:
    """
    Official office bookings for this customer email (tenant-scoped).

    Returns ``(ok, items)``. ``ok=False`` means Postgres failed — callers must
    not purge the SQLite wallet cache.
    """
    key = str(email or "").strip().lower()
    tid = str(tenant_id or "").strip()
    if not key or "@" not in key or not tid:
        return False, []

    try:
        tenant_uuid = UUID(tid)
    except ValueError:
        logger.warning("wallet reconcile: invalid tenant_id=%s", tid)
        return False, []

    try:
        from app.core.auth_deps import apply_tenant_rls
        from app.core.database import AsyncSessionLocal
        from app.models.booking import Booking
        from api.admin_booking_mapper import booking_to_admin_dict
    except Exception:
        logger.exception("wallet reconcile: imports failed")
        return False, []

    try:
        async with AsyncSessionLocal() as db:
            await apply_tenant_rls(db, tenant_uuid)
            # Match passenger_email OR wallet claim email stamped in metadata.
            email_match = or_(
                func.lower(Booking.passenger_email) == key,
                Booking.metadata_json.contains({"wallet_customer_email": key}),
            )
            result = await db.execute(
                select(Booking)
                .where(Booking.tenant_id == tenant_uuid, email_match)
                .order_by(Booking.created_at.desc())
                .limit(500)
            )
            rows = list(result.scalars().all())
            items = [booking_to_admin_dict(b) for b in rows]
            try:
                from ticketing.demo_catalog import is_demo_booking_ref

                items = [
                    item
                    for item in items
                    if not is_demo_booking_ref(item.get("pnr") or item.get("id"))
                ]
            except Exception:
                pass
            return True, items
    except Exception:
        logger.exception(
            "wallet reconcile: postgres list failed email=%s tenant=%s",
            key,
            tid,
        )
        return False, []


async def reconcile_wallet_bookings(
    *,
    email: str,
    tenant_id: str,
    customer_id: str | None = None,
) -> list[dict[str, Any]]:
    """
    Pull Postgres → SQLite cache, purge orphans, return sealed wallet list.

    Desktop admin and My Wallet then share the same seats / passengers / status.
    """
    from ticketing.customer_bookings import (
        delete_booking_for_customer,
        list_bookings_for_email,
        upsert_booking,
    )

    key = str(email or "").strip().lower()
    tid = str(tenant_id or "").strip()
    if not key or not tid:
        return []

    pg_ok, pg_items = await fetch_postgres_wallet_bookings(email=key, tenant_id=tid)
    if not pg_ok:
        # Offline / PG outage — serve sealed cache, never invent or purge.
        return await list_bookings_for_email(key, tenant_id=tid)

    canonical: set[str] = set()

    for item in pg_items:
        stamped = dict(item)
        stamped["email"] = key
        stamped["tenant_id"] = tid
        stamped["tenantId"] = tid
        if customer_id and not stamped.get("customerId"):
            stamped["customerId"] = customer_id
        try:
            saved = await upsert_booking(
                stamped,
                customer_email=key,
                customer_id=customer_id or stamped.get("customerId"),
                tenant_id=tid,
            )
            canonical |= _booking_aliases(saved or stamped)
        except Exception:
            logger.exception(
                "wallet reconcile: upsert failed id=%s",
                stamped.get("id"),
            )
            canonical |= _booking_aliases(stamped)

    cached = await list_bookings_for_email(key, tenant_id=tid)
    for row in cached:
        aliases = _booking_aliases(row)
        if aliases & canonical:
            continue
        try:
            await delete_booking_for_customer(
                str(row.get("id") or ""),
                email=key,
                tenant_id=tid,
            )
        except Exception:
            logger.exception(
                "wallet reconcile: orphan delete failed id=%s",
                row.get("id"),
            )

    return await list_bookings_for_email(key, tenant_id=tid)


async def mirror_admin_booking_to_wallet(admin_dict: dict[str, Any]) -> None:
    """Immediate desktop → wallet push (after create/patch/cancel/pay)."""
    try:
        from ticketing.customer_bookings import upsert_booking

        email = str(admin_dict.get("email") or "").strip().lower()
        if not email or "@" not in email:
            return
        tid = str(admin_dict.get("tenant_id") or admin_dict.get("tenantId") or "").strip() or None
        await upsert_booking(admin_dict, customer_email=email, tenant_id=tid)
    except Exception:
        logger.debug("mirror_admin_booking_to_wallet skipped", exc_info=True)


async def purge_wallet_booking_aliases(
    *,
    aliases: list[str],
    email: str | None = None,
    tenant_id: str | None = None,
) -> None:
    """Desktop hard-delete → drop matching wallet cache rows."""
    from ticketing.customer_bookings import delete_booking_by_aliases

    await delete_booking_by_aliases(
        [str(a).strip() for a in aliases if str(a or "").strip()],
        email=email,
        tenant_id=tenant_id,
    )
