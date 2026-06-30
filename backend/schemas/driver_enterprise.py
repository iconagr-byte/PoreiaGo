"""Pydantic models — Driver PWA enterprise toolkit."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class DriverCheckinRequest(BaseModel):
    """Passenger check-in via scanned ticket id or raw QR payload."""

    ticket_id: str | None = Field(default=None, description="Booking id, ticket ref, or scanned QR token")
    qr_raw: str | None = Field(default=None, description="Raw QR string from camera scanner")


class DriverCheckinResponse(BaseModel):
    ok: bool
    result: Literal["SUCCESS", "FAILURE"]
    passenger_name: str | None = None
    seat_number: str | None = None
    booking_id: str | None = None
    message: str | None = None
    reason: str | None = None
    elapsed_ms: float | None = None


class PreTripInspectionItem(BaseModel):
    key: str
    label: str
    status: Literal["pass", "fail", "na"] = "pass"


class DriverInspectionRequest(BaseModel):
    items: dict[str, Literal["pass", "fail", "na"]]
    notes: str | None = None


class DriverInspectionResponse(BaseModel):
    id: str
    trip_id: int
    driver_id: str
    status: Literal["completed", "blocked"]
    items: dict[str, str]
    completed_at: datetime
    cleared_for_shift: bool


class DriverExpenseUploadResponse(BaseModel):
    id: str
    amount: float
    category: str
    trip_id: int
    driver_id: str
    receipt_path: str | None = None
    created_at: datetime


class DriverSosRequest(BaseModel):
    lat: float
    lng: float
    accuracy_m: float | None = None
    message: str | None = None
    incident_type: str | None = Field(default="sos", description="sos | breakdown | accident | delay")


class DriverSosResponse(BaseModel):
    ok: bool
    alert_id: str
    message: str
    published_redis: bool
