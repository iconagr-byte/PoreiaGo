from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class PersonalInfoSchema(BaseModel):
    name: str
    license_no: str
    phone: str
    email: EmailStr


class DriverCreateRequest(BaseModel):
    personal_info: PersonalInfoSchema
    hiring_date: date
    salary_per_km: Decimal | None = None
    salary_per_trip: Decimal | None = None
    bonus_structure: dict[str, Any] = Field(default_factory=dict)


class DriverResponse(BaseModel):
    id: str
    name: str
    license_no: str
    phone: str
    email: str
    hiring_date: date
    status: str
    salary_per_km: Decimal | None
    salary_per_trip: Decimal | None
    current_balance: Decimal
    bonus_structure: dict[str, Any]


class DriverStatsResponse(BaseModel):
    driver_id: str
    total_kms_driven: Decimal
    total_hours_driven: Decimal
    assignments_count: int
    avg_passenger_rating: float | None
    rating_percentile: float | None
    trips_completed: int
    feedback_count: int
    computed_at: datetime
    cache_hit: bool


class DocumentRegisterRequest(BaseModel):
    doc_type: str
    storage_key: str
    expires_at: date
    file_name: str | None = None


class DocumentResponse(BaseModel):
    id: str
    doc_type: str
    storage_key: str
    expires_at: date
    days_until_expiry: int
    alert_required: bool


class EarningRequest(BaseModel):
    amount: Decimal = Field(gt=0)
    trip_id: int | None = None
    earning_type: str = "trip_commission"
    description: str | None = None
    idempotency_key: str | None = None


class ExpenseRequest(BaseModel):
    amount: Decimal = Field(gt=0)
    category: str
    trip_id: int | None = None
    description: str | None = None
    receipt_ref: str | None = None
    idempotency_key: str | None = None


class PayRateChangeRequest(BaseModel):
    salary_per_km: Decimal | None = None
    salary_per_trip: Decimal | None = None
    bonus_structure: dict[str, Any] | None = None
    change_reason: str | None = None


class AvailabilityQuery(BaseModel):
    shift_start: datetime
    shift_end: datetime


class AvailabilityResponse(BaseModel):
    available: bool
    reasons: list[str]
    conflicting_assignment_ids: list[str]


class AssignmentRequest(BaseModel):
    trip_id: int
    shift_start: datetime
    shift_end: datetime
    distance_km: float | None = None


class PayoutSummaryResponse(BaseModel):
    driver_id: str
    period_start: date
    period_end: date
    total_earnings: Decimal
    total_expenses: Decimal
    advances_and_deductions: Decimal
    net_payout: Decimal
    trip_count: int
    line_items: list[dict[str, Any]]
