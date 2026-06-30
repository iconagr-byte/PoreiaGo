"""GDPR data subject access (export) and erasure (anonymization)."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditAction
from app.models.booking import Booking
from app.models.tenant import Tenant
from app.models.user import User
from app.services.audit_service import ANON_EMAIL_DOMAIN, AuditService, audit_log_to_dict
from app.services.auth_service import hash_password


def _anon_email(resource_id: UUID | str) -> str:
    return f"erased-{resource_id}@{ANON_EMAIL_DOMAIN}"


def _booking_dict(booking: Booking) -> dict[str, Any]:
    return {
        "id": str(booking.id),
        "reference_code": booking.reference_code,
        "status": booking.status.value,
        "passenger_name": booking.passenger_name,
        "passenger_email": booking.passenger_email,
        "passenger_vat_id": booking.passenger_vat_id,
        "seat_label": booking.seat_label,
        "amount_eur": str(booking.amount_eur),
        "currency": booking.currency,
        "fiscal_mark": booking.fiscal_mark,
        "metadata_json": booking.metadata_json,
        "notes": booking.notes,
        "created_at": booking.created_at.isoformat() if booking.created_at else None,
        "updated_at": booking.updated_at.isoformat() if booking.updated_at else None,
    }


def _user_dict(user: User) -> dict[str, Any]:
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "roles": list(user.roles or []),
        "is_active": user.is_active,
        "mfa_enabled": user.mfa_enabled,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


class GdprService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._audit = AuditService(session)

    async def export_subject(
        self,
        *,
        tenant_id: UUID,
        subject_email: str,
    ) -> dict[str, Any]:
        email = subject_email.strip().lower()

        user_result = await self._session.execute(
            select(User).where(User.tenant_id == tenant_id, func.lower(User.email) == email),
        )
        user = user_result.scalar_one_or_none()

        bookings_result = await self._session.execute(
            select(Booking)
            .where(
                Booking.tenant_id == tenant_id,
                func.lower(Booking.passenger_email) == email,
            )
            .order_by(Booking.created_at.desc()),
        )
        bookings = list(bookings_result.scalars().all())

        audit_entries = await self._audit.logs_for_subject_email(tenant_id, email)

        return {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "tenant_id": str(tenant_id),
            "subject_email": email,
            "user_account": _user_dict(user) if user else None,
            "bookings": [_booking_dict(b) for b in bookings],
            "audit_trail_as_actor": [audit_log_to_dict(e) for e in audit_entries],
            "counts": {
                "bookings": len(bookings),
                "audit_entries": len(audit_entries),
            },
        }

    async def erase_subject(
        self,
        *,
        tenant_id: UUID,
        subject_email: str,
        actor_id: UUID | None,
        actor_email: str | None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> dict[str, Any]:
        email = subject_email.strip().lower()

        bookings_result = await self._session.execute(
            select(Booking).where(
                Booking.tenant_id == tenant_id,
                func.lower(Booking.passenger_email) == email,
            ),
        )
        bookings = list(bookings_result.scalars().all())

        user_result = await self._session.execute(
            select(User).where(User.tenant_id == tenant_id, func.lower(User.email) == email),
        )
        user = user_result.scalar_one_or_none()

        if not bookings and not user:
            raise ValueError("No personal data found for this email in this tenant")

        erased_bookings = 0
        for booking in bookings:
            meta = dict(booking.metadata_json or {})
            for key in ("phone", "passenger_name", "email"):
                if key in meta:
                    meta[key] = "[redacted]"
            booking.passenger_name = "Erased Data Subject"
            booking.passenger_email = _anon_email(booking.id)
            booking.passenger_vat_id = None
            booking.notes = None
            booking.metadata_json = meta
            erased_bookings += 1

        erased_user = False
        if user:
            user.full_name = "Erased User"
            user.email = _anon_email(user.id)
            user.is_active = False
            user.mfa_enabled = False
            user.mfa_secret_encrypted = None
            user.password_hash = hash_password(secrets.token_urlsafe(32))
            erased_user = True

        redacted_audit = await self._audit.redact_subject_references(tenant_id, email)

        tenant_result = await self._session.execute(
            select(Tenant.legal_name).where(Tenant.id == tenant_id),
        )
        tenant_name = tenant_result.scalar_one_or_none() or "Tenant"

        notification_refs: dict[str, str | None] = {"subject": None, "admin": None}
        try:
            from app.services.notification_service import send_gdpr_erasure_emails

            notification_refs = await send_gdpr_erasure_emails(
                tenant_legal_name=tenant_name,
                subject_email=email,
                actor_email=actor_email,
                bookings_anonymized=erased_bookings,
                user_anonymized=erased_user,
            )
        except Exception:
            pass

        await self._audit.record(
            tenant_id=tenant_id,
            actor_id=actor_id,
            actor_email=actor_email,
            action=AuditAction.ERASE,
            resource_type="data_subject",
            resource_id=email,
            ip_address=ip_address,
            user_agent=user_agent,
            after_state={
                "bookings_anonymized": erased_bookings,
                "user_anonymized": erased_user,
                "audit_rows_redacted": redacted_audit,
            },
            detail="GDPR Article 17 erasure completed",
        )

        return {
            "erased_at": datetime.now(timezone.utc).isoformat(),
            "subject_email": email,
            "bookings_anonymized": erased_bookings,
            "user_anonymized": erased_user,
            "audit_rows_redacted": redacted_audit,
            "notification_sent": bool(notification_refs.get("subject")),
        }
