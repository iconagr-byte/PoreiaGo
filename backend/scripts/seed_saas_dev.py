"""
Development seed — demo tenant, admin user, telemetry API key, sample stop.

Usage (from backend/):
    python -m scripts.seed_saas_dev
"""

from __future__ import annotations

import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_BACKEND_ROOT))

from sqlalchemy import select, text

from app.core.database import AsyncSessionLocal, engine
from app.models.api_key import ApiKeyScope
from app.models.booking import Booking, BookingStatus
from app.models.stop import Stop
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.tenant import Tenant, TenantPlan
from app.models.user import User, UserRole
from api.admin_booking_mapper import seed_booking_kwargs
from app.services.api_key_service import ApiKeyService
from app.services.auth_service import hash_password

DEMO_TENANT_SLUG = "achillio"
DEMO_ADMIN_EMAIL = "admin@achillio.gr"
DEMO_ADMIN_PASSWORD = "Admin123!"


async def seed() -> None:
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))

    async with AsyncSessionLocal() as session:
        existing = await session.execute(select(Tenant).where(Tenant.slug == DEMO_TENANT_SLUG))
        tenant = existing.scalar_one_or_none()
        if tenant:
            print(f"Tenant already exists: {tenant.id} ({tenant.slug})")
        else:
            tenant = Tenant(
                id=uuid4(),
                slug=DEMO_TENANT_SLUG,
                legal_name="Achillio Travel Demo",
                vat_number="999999999",
                subdomain="achillio",
                plan=TenantPlan.PROFESSIONAL,
                is_active=True,
            )
            session.add(tenant)
            await session.flush()
            print(f"Created tenant: {tenant.id}")

        user_result = await session.execute(
            select(User).where(User.tenant_id == tenant.id, User.email == DEMO_ADMIN_EMAIL),
        )
        admin = user_result.scalar_one_or_none()
        if not admin:
            admin = User(
                id=uuid4(),
                tenant_id=tenant.id,
                email=DEMO_ADMIN_EMAIL,
                password_hash=hash_password(DEMO_ADMIN_PASSWORD),
                full_name="Demo Admin",
                roles=[
                    UserRole.TENANT_ADMIN.value,
                    UserRole.DISPATCHER.value,
                    UserRole.SUPERADMIN.value,
                ],
                is_active=True,
                mfa_enabled=False,
            )
            session.add(admin)
            await session.flush()
            print(f"Created admin user: {admin.id}")
        elif UserRole.SUPERADMIN.value not in (admin.roles or []):
            admin.roles = list(admin.roles or []) + [UserRole.SUPERADMIN.value]
            print("Added superadmin role to demo admin")

        sub_result = await session.execute(
            select(Subscription).where(Subscription.tenant_id == tenant.id),
        )
        if not sub_result.scalar_one_or_none():
            session.add(
                Subscription(
                    id=uuid4(),
                    tenant_id=tenant.id,
                    plan=tenant.plan,
                    status=SubscriptionStatus.TRIALING,
                    base_amount_cents=29900,
                    trial_ends_at=datetime.now(timezone.utc) + timedelta(days=14),
                ),
            )
            print("Created trial subscription (14 days)")

        key_svc = ApiKeyService(session)
        from app.models.api_key import TenantApiKey

        key_exists = await session.execute(
            select(TenantApiKey).where(
                TenantApiKey.tenant_id == tenant.id,
                TenantApiKey.name == "GPS Tracker (dev)",
            ),
        )
        if key_exists.scalar_one_or_none():
            print("Telemetry API key already exists (see prior seed output).")
        else:
            _row, raw_key = await key_svc.create_key(
                tenant_id=tenant.id,
                name="GPS Tracker (dev)",
                scope=ApiKeyScope.TELEMETRY,
            )
            print("\n=== TELEMETRY API KEY (save now — shown once) ===")
            print(raw_key)
            print("Header: X-API-Key: <key above>\n")

        demo_bookings = [
            seed_booking_kwargs(
                tenant_id=tenant.id,
                reference_code="BK-1029",
                passenger_name="John Doe",
                passenger_email="john@example.com",
                amount_eur=45.0,
                status=BookingStatus.PAID,
                trip_title="Ημερήσια στα Μετέωρα",
                external_trip_id=1,
                seat_label="4A",
                seats=["4A"],
                phone="+30 694 123 4567",
            ),
            seed_booking_kwargs(
                tenant_id=tenant.id,
                reference_code="BK-1030",
                passenger_name="Maria Papadopoulou",
                passenger_email="maria@example.com",
                amount_eur=90.0,
                status=BookingStatus.PAID,
                trip_title="Απόδραση στην Πρωτεύουσα",
                external_trip_id=2,
                seat_label="2B, 2C",
                seats=["2B", "2C"],
                phone="+30 697 987 6543",
            ),
            seed_booking_kwargs(
                tenant_id=tenant.id,
                reference_code="BK-1031",
                passenger_name="George K.",
                passenger_email="george@example.com",
                amount_eur=65.0,
                status=BookingStatus.PENDING,
                trip_title="Μαγευτικά Ιωάννινα",
                external_trip_id=3,
                seat_label="1A",
                seats=["1A"],
                phone="+30 693 444 5555",
            ),
            seed_booking_kwargs(
                tenant_id=tenant.id,
                reference_code="BK-0995",
                passenger_name="John Doe",
                passenger_email="john@example.com",
                amount_eur=120.0,
                status=BookingStatus.BOARDED,
                trip_title="3ήμερο Ναύπλιο",
                external_trip_id=1,
                seat_label="6C",
                seats=["6C"],
                phone="+30 694 123 4567",
                checked_in=True,
            ),
        ]
        for spec in demo_bookings:
            ref = spec["reference_code"]
            exists = await session.execute(
                select(Booking).where(
                    Booking.tenant_id == tenant.id,
                    Booking.reference_code == ref,
                ),
            )
            if exists.scalar_one_or_none():
                continue
            session.add(Booking(**spec))
            print(f"Seeded booking {ref}")

        stop_result = await session.execute(
            select(Stop).where(Stop.tenant_id == tenant.id, Stop.name == "Athens Syntagma (demo)"),
        )
        if not stop_result.scalar_one_or_none():
            await session.execute(
                text(
                    """
                    INSERT INTO stops (id, tenant_id, trip_id, name, location, created_at, updated_at)
                    VALUES (
                      :id, :tenant_id, NULL, :name,
                      ST_SetSRID(ST_MakePoint(23.7361, 37.9753), 4326)::geography,
                      now(), now()
                    )
                    """
                ),
                {
                    "id": str(uuid4()),
                    "tenant_id": str(tenant.id),
                    "name": "Athens Syntagma (demo)",
                },
            )
            print("Created demo stop: Athens Syntagma")

        await session.commit()

        print("\n=== LOGIN ===")
        print(f"tenant_id: {tenant.id}")
        print(f"email:     {DEMO_ADMIN_EMAIL}")
        print(f"password:  {DEMO_ADMIN_PASSWORD}")
        print("POST /api/v1/auth/login with JSON body { tenant_id, email, password }")


def main() -> None:
    asyncio.run(seed())


if __name__ == "__main__":
    main()
