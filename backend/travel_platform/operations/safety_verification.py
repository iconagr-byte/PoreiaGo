"""
Cleaning & safety verification workflow for drivers before departure.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.base_service import TenantScopedService
from core.exceptions import SafetyVerificationError


class ChecklistItemStatus(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    NA = "na"


class VerificationStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"


@dataclass(frozen=True)
class ChecklistItem:
    key: str
    label: str
    required: bool = True


DEFAULT_SAFETY_CHECKLIST: tuple[ChecklistItem, ...] = (
    ChecklistItem("interior_clean", "Εσωτερικός καθαρισμός / απολύμανση", True),
    ChecklistItem("restroom", "Τουαλέτα — καθαριότητα & αναλώσιμα", True),
    ChecklistItem("fire_extinguisher", "Πυροσβεστήρας — ημερομηνία λήξης OK", True),
    ChecklistItem("first_aid", "Φαρμακείο πρώτων βοηθειών", True),
    ChecklistItem("seatbelts", "Ζώνες ασφαλείας — δειγματικός έλεγχος", True),
    ChecklistItem("emergency_exits", "Έξοδοι κινδύνου — προσβάσιμες", True),
    ChecklistItem("lights_hvac", "Φώτα & κλιματισμός — λειτουργικά", False),
)


@dataclass
class SafetyVerificationRecord:
    id: UUID
    trip_id: int
    driver_id: str
    status: VerificationStatus
    items: dict[str, str]
    notes: str | None
    completed_at: datetime | None


class SafetyVerificationService(TenantScopedService):
    """Driver submits checklist; trip cannot board until completed (policy hook)."""

    async def start_verification(self, trip_id: int, driver_id: str) -> SafetyVerificationRecord:
        await self._bind_tenant_rls()
        vid = uuid4()
        await self._session.execute(
            text("""
                INSERT INTO safety_verifications (id, tenant_id, trip_id, driver_id, status, items, created_at)
                VALUES (:id, :tenant, :trip, :driver, 'in_progress', '{}'::jsonb, NOW())
            """),
            {"id": str(vid), "tenant": str(self._tenant_id), "trip": trip_id, "driver": driver_id},
        )
        await self._audit("safety.verification_started", "trip", str(trip_id), metadata={"driver_id": driver_id})
        return SafetyVerificationRecord(
            id=vid,
            trip_id=trip_id,
            driver_id=driver_id,
            status=VerificationStatus.IN_PROGRESS,
            items={},
            notes=None,
            completed_at=None,
        )

    async def submit_checklist(
        self,
        verification_id: UUID,
        items: dict[str, ChecklistItemStatus],
        *,
        notes: str | None = None,
    ) -> SafetyVerificationRecord:
        await self._bind_tenant_rls()
        required_keys = {i.key for i in DEFAULT_SAFETY_CHECKLIST if i.required}
        submitted = {k: v.value if isinstance(v, ChecklistItemStatus) else v for k, v in items.items()}
        missing = required_keys - set(submitted.keys())
        if missing:
            raise SafetyVerificationError(f"Missing required checklist items: {missing}")

        failed = [k for k, v in submitted.items() if v == ChecklistItemStatus.FAIL.value]
        status = VerificationStatus.BLOCKED if failed else VerificationStatus.COMPLETED
        completed_at = datetime.now(timezone.utc) if status == VerificationStatus.COMPLETED else None

        await self._session.execute(
            text("""
                UPDATE safety_verifications
                SET items = :items::jsonb,
                    status = :status,
                    notes = :notes,
                    completed_at = :completed,
                    updated_at = NOW()
                WHERE id = :id AND tenant_id = :tenant
            """),
            {
                "items": json.dumps(submitted),
                "status": status.value,
                "notes": notes,
                "completed": completed_at,
                "id": str(verification_id),
                "tenant": str(self._tenant_id),
            },
        )
        await self._audit(
            "safety.verification_submitted",
            "safety_verification",
            str(verification_id),
            metadata={"status": status.value, "failed_items": failed},
        )
        return await self.get_verification(verification_id)

    async def get_verification(self, verification_id: UUID) -> SafetyVerificationRecord:
        await self._bind_tenant_rls()
        r = await self._session.execute(
            text("""
                SELECT id, trip_id, driver_id, status, items, notes, completed_at
                FROM safety_verifications
                WHERE id = :id AND tenant_id = :tenant
            """),
            {"id": str(verification_id), "tenant": str(self._tenant_id)},
        )
        row = r.mappings().first()
        if not row:
            raise SafetyVerificationError("Verification not found")
        return SafetyVerificationRecord(
            id=UUID(str(row["id"])),
            trip_id=row["trip_id"],
            driver_id=row["driver_id"],
            status=VerificationStatus(row["status"]),
            items=row["items"] or {},
            notes=row["notes"],
            completed_at=row["completed_at"],
        )

    async def trip_cleared_for_boarding(self, trip_id: int) -> bool:
        await self._bind_tenant_rls()
        r = await self._session.execute(
            text("""
                SELECT 1 FROM safety_verifications
                WHERE tenant_id = :tenant AND trip_id = :trip AND status = 'completed'
                ORDER BY completed_at DESC LIMIT 1
            """),
            {"tenant": str(self._tenant_id), "trip": trip_id},
        )
        return r.scalar() is not None
