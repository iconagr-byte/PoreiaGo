"""Pull SaaS (Postgres) bookings into My Wallet SQLite by customer email.

Office walk-in / guest checkouts write Postgres + boarding tickets, but historically
skipped `customer_bookings`. Wallet list only reads SQLite — so tickets were
invisible until manual claim (email + code). This sync closes that gap on every
wallet load, scoped to the Host office tenant + JWT email.
"""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import func, select

logger = logging.getLogger(__name__)


async def pull_postgres_bookings_into_wallet(
    *,
    customer_email: str,
    tenant_id: str | None,
    limit: int = 100,
) -> int:
    """
    Mirror Postgres bookings for this email+tenant into wallet SQLite.

    Returns number of rows upserted. Safe no-op when Postgres is unavailable.
    """
    email = str(customer_email or "").strip().lower()
    if not email or "@" not in email:
        return 0
    tid_raw = str(tenant_id or "").strip()
    if not tid_raw:
        return 0
    try:
        tid = UUID(tid_raw)
    except ValueError:
        return 0

    try:
        from api.admin_booking_mapper import booking_to_admin_dict
        from app.core.auth_deps import apply_tenant_rls
        from app.core.database import AsyncSessionLocal
        from app.models.booking import Booking
        from ticketing.customer_bookings import upsert_booking
    except Exception as exc:
        logger.debug("wallet postgres pull imports failed: %s", exc)
        return 0

    upserted = 0
    try:
        async with AsyncSessionLocal() as session:
            await apply_tenant_rls(session, tid)
            result = await session.execute(
                select(Booking)
                .where(
                    Booking.tenant_id == tid,
                    func.lower(Booking.passenger_email) == email,
                )
                .order_by(Booking.created_at.desc())
                .limit(max(1, min(int(limit), 200))),
            )
            rows = list(result.scalars().all())
            for booking in rows:
                try:
                    admin = booking_to_admin_dict(booking)
                    await upsert_booking(
                        admin,
                        customer_email=email,
                        tenant_id=str(tid),
                    )
                    upserted += 1
                except Exception as row_exc:
                    logger.debug(
                        "wallet upsert skip %s: %s",
                        getattr(booking, "reference_code", None),
                        row_exc,
                    )
    except Exception as exc:
        logger.warning("wallet postgres pull failed for %s: %s", email, exc)
        return 0

    return upserted


async def mirror_single_booking_to_wallet(booking, *, tenant_id: str | None = None) -> bool:
    """Write-side helper after guest/office create — best-effort."""
    try:
        from api.admin_booking_mapper import booking_to_admin_dict
        from ticketing.customer_bookings import upsert_booking
    except Exception:
        return False

    email = str(getattr(booking, "passenger_email", None) or "").strip().lower()
    if not email or "@" not in email:
        return False
    tid = tenant_id or getattr(booking, "tenant_id", None)
    try:
        admin = booking_to_admin_dict(booking)
        await upsert_booking(
            admin,
            customer_email=email,
            tenant_id=str(tid) if tid else None,
        )
        return True
    except Exception as exc:
        logger.debug("mirror_single_booking_to_wallet failed: %s", exc)
        return False
