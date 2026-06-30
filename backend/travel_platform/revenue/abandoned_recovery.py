"""
Abandoned booking recovery — Celery task scans PENDING bookings older than N minutes
and dispatches email/SMS reminders (idempotent per booking).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Protocol
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.base_service import TenantScopedService
from core.config import platform_settings

logger = logging.getLogger(__name__)


class NotificationChannel(str, Enum):
    EMAIL = "email"
    SMS = "sms"


@dataclass(frozen=True)
class RecoveryCandidate:
    booking_id: str
    tenant_id: UUID
    customer_email: str | None
    customer_phone: str | None
    trip_title: str
    checkout_url: str
    pending_since: datetime


class NotificationAdapter(Protocol):
    async def send_email(self, to: str, subject: str, body_html: str) -> str: ...
    async def send_sms(self, to: str, body: str) -> str: ...


class StubNotificationAdapter:
    """Delegates to platform.notifications.dispatcher (log + optional SMTP)."""

    async def send_email(self, to: str, subject: str, body_html: str) -> str:
        from travel_platform.notifications.dispatcher import send_email as dispatch_email

        return await dispatch_email(to, subject, body_html)

    async def send_sms(self, to: str, body: str) -> str:
        from travel_platform.notifications.dispatcher import send_sms as dispatch_sms

        return await dispatch_sms(to, body)


class AbandonedBookingRecoveryService(TenantScopedService):
    """
    Per-tenant recovery logic. Global scanner in workers/tasks.py calls
    `scan_all_tenants` via raw SQL across tenants (worker uses service role).
    """

    def __init__(
        self,
        session: AsyncSession,
        tenant_id: UUID,
        notifier: NotificationAdapter | None = None,
        **kwargs,
    ):
        super().__init__(session, tenant_id, **kwargs)
        self._notifier = notifier or StubNotificationAdapter()
        self._pending_minutes = platform_settings.abandoned_pending_minutes

    async def find_recovery_candidates(self) -> list[RecoveryCandidate]:
        await self._bind_tenant_rls()
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=self._pending_minutes)
        # Assumes columns: recovery_sent_at, customer_email, customer_phone, trip_title
        q = text("""
            SELECT id::text AS booking_id,
                   tenant_id,
                   customer_email,
                   customer_phone,
                   COALESCE(trip_title, 'Your trip') AS trip_title,
                   created_at AS pending_since
            FROM bookings
            WHERE tenant_id = :tenant_id
              AND status = 'PENDING'
              AND created_at < :cutoff
              AND recovery_sent_at IS NULL
            LIMIT 500
        """)
        result = await self._session.execute(
            q,
            {"tenant_id": str(self._tenant_id), "cutoff": cutoff},
        )
        rows = result.mappings().all()
        base_url = "https://app.aerostride.app"
        try:
            from travel_platform.growth.branding_store import get_branding

            base_url = get_branding().checkout_base_url or base_url
        except Exception:
            pass
        return [
            RecoveryCandidate(
                booking_id=r["booking_id"],
                tenant_id=self._tenant_id,
                customer_email=r["customer_email"],
                customer_phone=r["customer_phone"],
                trip_title=r["trip_title"],
                checkout_url=f"{base_url}/checkout/resume/{r['booking_id']}",
                pending_since=r["pending_since"],
            )
            for r in rows
        ]

    async def process_candidate(self, candidate: RecoveryCandidate) -> bool:
        """Send notifications and mark recovery_sent_at. Returns True if any channel sent."""
        sent = False
        subject = f"Ολοκληρώστε την κράτησή σας — {candidate.trip_title}"
        body = (
            f"<p>Η κράτησή σας για <strong>{candidate.trip_title}</strong> είναι σε αναμονή.</p>"
            f'<p><a href="{candidate.checkout_url}">Συνέχεια πληρωμής</a></p>'
        )
        sms_body = f"AeroStride: Ολοκληρώστε την κράτηση για {candidate.trip_title}: {candidate.checkout_url}"

        if candidate.customer_email:
            await self._notifier.send_email(candidate.customer_email, subject, body)
            sent = True
        if candidate.customer_phone:
            await self._notifier.send_sms(candidate.customer_phone, sms_body)
            sent = True

        if not sent:
            logger.warning("No contact channels for booking %s", candidate.booking_id)
            return False

        await self._mark_recovery_sent(candidate.booking_id)
        await self._audit(
            "booking.recovery_sent",
            "booking",
            candidate.booking_id,
            metadata={"channels": ["email" if candidate.customer_email else None, "sms" if candidate.customer_phone else None]},
        )
        return True

    async def _mark_recovery_sent(self, booking_id: str) -> None:
        await self._bind_tenant_rls()
        await self._session.execute(
            text("""
                UPDATE bookings
                SET recovery_sent_at = NOW(), updated_at = NOW()
                WHERE id = :bid AND tenant_id = :tid
            """),
            {"bid": booking_id, "tid": str(self._tenant_id)},
        )
