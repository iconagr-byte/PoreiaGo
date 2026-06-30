"""Domain types for driver personnel & logistics."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID


class DriverStatus(str, Enum):
    ACTIVE = "active"
    ON_LEAVE = "on_leave"
    TERMINATED = "terminated"


class ExpenseCategory(str, Enum):
    FUEL = "fuel"
    TOLLS = "tolls"
    MAINTENANCE = "maintenance"
    OTHER = "other"


class AssignmentStatus(str, Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


@dataclass
class PersonalInfo:
    name: str
    license_no: str
    phone: str
    email: str

    def to_dict(self) -> dict[str, str]:
        return {
            "name": self.name,
            "license_no": self.license_no,
            "phone": self.phone,
            "email": self.email,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> PersonalInfo:
        return cls(
            name=data.get("name", ""),
            license_no=data.get("license_no", ""),
            phone=data.get("phone", ""),
            email=data.get("email", ""),
        )


@dataclass
class DriverRecord:
    id: UUID
    tenant_id: UUID
    personal_info: PersonalInfo
    hiring_date: date
    status: DriverStatus
    salary_per_km: Decimal | None
    salary_per_trip: Decimal | None
    bonus_structure: dict[str, Any]
    current_balance: Decimal
    created_at: datetime | None = None


@dataclass
class DriverStatsSnapshot:
    driver_id: UUID
    total_kms_driven: Decimal
    total_hours_driven: Decimal
    assignments_count: int
    avg_passenger_rating: float | None
    trips_completed: int
    feedback_count: int
    rating_percentile: float | None
    computed_at: datetime
    cache_hit: bool = True


@dataclass
class DriverDocument:
    id: UUID
    driver_id: UUID
    doc_type: str
    storage_key: str
    file_name: str | None
    expires_at: date
    days_until_expiry: int
    alert_required: bool


@dataclass
class MonthlyPayoutSummary:
    driver_id: UUID
    period_start: date
    period_end: date
    total_earnings: Decimal
    total_expenses: Decimal
    advances_and_deductions: Decimal
    net_payout: Decimal
    trip_count: int
    line_items: list[dict[str, Any]] = field(default_factory=list)
    export_format: str = "accounting_v1"
