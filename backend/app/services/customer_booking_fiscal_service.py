"""Load fiscal receipt data for authenticated customers (My Wallet)."""

from __future__ import annotations

import os
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.admin_booking_mapper import build_fiscal_customer_fields, normalize_reference
from app.core.auth_deps import apply_tenant_rls
from app.core.database import AsyncSessionLocal
from app.models.booking import Booking
from app.models.fiscal_invoice import FiscalInvoice
from app.models.tenant import Tenant


async def _resolve_tenant_id(
    session: AsyncSession,
    *,
    tenant_id: UUID | None,
    booking_key: str,
    customer_email: str,
) -> UUID:
    """Prefer explicit office tenant; never assume Achillio Travel via slug."""
    if tenant_id is not None:
        return tenant_id

    env_tid = os.getenv("DEFAULT_TENANT_ID", "").strip()
    if env_tid:
        return UUID(env_tid)

    email = customer_email.strip().lower()
    key = booking_key.strip()
    filters = []
    try:
        filters.append(Booking.id == UUID(key))
    except ValueError:
        pass
    ref = normalize_reference(key)
    filters.append(Booking.reference_code == ref)
    filters.append(Booking.reference_code == key.upper())
    if filters and email:
        # Locate the booking by reference + email across offices, then scope.
        result = await session.execute(
            select(Booking)
            .where(
                or_(*filters),
                Booking.passenger_email.ilike(email),
            )
            .limit(1),
        )
        booking = result.scalar_one_or_none()
        if booking and booking.tenant_id:
            return booking.tenant_id

    # Historic PoreiaGo seed slug — not Achillio Travel (admin-achillio-gr).
    slug = (os.getenv("DEFAULT_TENANT_SLUG") or "achillio").strip().lower()
    result = await session.execute(select(Tenant).where(Tenant.slug == slug).limit(1))
    tenant = result.scalar_one_or_none()
    if tenant:
        return tenant.id
    raise ValueError("Postgres tenant not configured")


class CustomerBookingFiscalService:
    async def fetch_for_customer(
        self,
        *,
        booking_key: str,
        customer_email: str,
        tenant_id: UUID | None = None,
    ) -> dict:
        email = customer_email.strip().lower()
        if not email:
            raise ValueError("Customer email is required")

        async with AsyncSessionLocal() as session:
            resolved = await _resolve_tenant_id(
                session,
                tenant_id=tenant_id,
                booking_key=booking_key,
                customer_email=email,
            )
            await apply_tenant_rls(session, resolved)

            key = booking_key.strip()
            filters = []
            try:
                filters.append(Booking.id == UUID(key))
            except ValueError:
                pass
            ref = normalize_reference(key)
            filters.append(Booking.reference_code == ref)
            filters.append(Booking.reference_code == key.upper())
            if not filters:
                raise ValueError("Invalid booking id")

            result = await session.execute(
                select(Booking)
                .where(
                    Booking.tenant_id == resolved,
                    or_(*filters),
                )
                .limit(1),
            )
            booking = result.scalar_one_or_none()
            if not booking:
                raise LookupError("Booking not found")

            booking_email = (booking.passenger_email or "").strip().lower()
            if booking_email != email:
                raise PermissionError("Forbidden")

            inv_result = await session.execute(
                select(FiscalInvoice)
                .where(FiscalInvoice.booking_id == booking.id)
                .order_by(FiscalInvoice.created_at),
            )
            invoices = list(inv_result.scalars().all())
            tenant_row = await session.execute(select(Tenant).where(Tenant.id == resolved))
            tenant = tenant_row.scalar_one_or_none()
            return build_fiscal_customer_fields(booking, invoices, tenant=tenant)
