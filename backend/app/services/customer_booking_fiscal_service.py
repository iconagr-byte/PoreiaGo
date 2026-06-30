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

DEFAULT_TENANT_SLUG = os.getenv("DEFAULT_TENANT_SLUG", "achillio")


async def _resolve_default_tenant_id(session: AsyncSession) -> UUID:
    env_tid = os.getenv("DEFAULT_TENANT_ID", "").strip()
    if env_tid:
        return UUID(env_tid)
    result = await session.execute(
        select(Tenant).where(Tenant.slug == DEFAULT_TENANT_SLUG).limit(1),
    )
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
    ) -> dict:
        email = customer_email.strip().lower()
        if not email:
            raise ValueError("Customer email is required")

        async with AsyncSessionLocal() as session:
            tenant_id = await _resolve_default_tenant_id(session)
            await apply_tenant_rls(session, tenant_id)

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
                    Booking.tenant_id == tenant_id,
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
            tenant_row = await session.execute(select(Tenant).where(Tenant.id == tenant_id))
            tenant = tenant_row.scalar_one_or_none()
            return build_fiscal_customer_fields(booking, invoices, tenant=tenant)
