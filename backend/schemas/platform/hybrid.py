from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class FlightUpsertRequest(BaseModel):
    id: UUID | None = None
    flight_number: str = Field(..., min_length=1, max_length=32)
    airline: str = ""
    departure_airport: str = Field(..., min_length=3, max_length=8)
    arrival_airport: str = Field(..., min_length=3, max_length=8)
    departure_time: datetime
    arrival_time: datetime
    pnr_code: str | None = None
    seats_allocated: int = Field(default=0, ge=0)
    cost_per_seat: float = Field(default=0, ge=0)
    total_cost: float = Field(default=0, ge=0)
    currency: str = "EUR"
    status: str = "scheduled"
    delay_minutes: int = 0
    notes: str | None = None
    trip_title: str | None = None


class FlightResponse(BaseModel):
    id: str
    trip_id: int
    flight_number: str
    airline: str
    departure_airport: str
    arrival_airport: str
    departure_time: str | None
    arrival_time: str | None
    pnr_code: str | None = None
    seats_allocated: int = 0
    cost_per_seat: float = 0
    total_cost: float = 0
    currency: str = "EUR"
    status: str = "scheduled"
    delay_minutes: int = 0
    notes: str | None = None


class SegmentItem(BaseModel):
    id: UUID | None = None
    sequence: int = 0
    segment_type: str = "ground_transfer"
    title: str = ""
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    flight_id: UUID | None = None
    vehicle_ref: str | None = None
    origin_label: str | None = None
    destination_label: str | None = None
    ground_cost: float = 0
    currency: str = "EUR"
    metadata: dict[str, Any] = Field(default_factory=dict)


class SegmentsReplaceRequest(BaseModel):
    segments: list[SegmentItem] = Field(default_factory=list)


class SegmentResponse(BaseModel):
    id: str
    trip_id: int
    sequence: int
    segment_type: str
    title: str
    starts_at: str | None = None
    ends_at: str | None = None
    flight_id: str | None = None
    vehicle_ref: str | None = None
    origin_label: str | None = None
    destination_label: str | None = None
    ground_cost: float = 0
    currency: str = "EUR"
    metadata: dict[str, Any] = Field(default_factory=dict)


class PassengerSeatUpsertRequest(BaseModel):
    id: UUID | None = None
    flight_id: UUID
    booking_id: str | None = None
    passenger_name: str = Field(..., min_length=1)
    ground_seat: str | None = None
    flight_seat: str | None = None
    ticket_code: str | None = None
    pnr_code: str | None = None


class LuggageUpsertRequest(BaseModel):
    id: UUID | None = None
    booking_id: str | None = None
    passenger_name: str = Field(..., min_length=1)
    checkin_status: str = "pending"
    luggage_count: int = Field(default=0, ge=0)
    luggage_notes: str | None = None
    checked_by: str | None = None
    checked_at: datetime | None = None


class YieldCalculateRequest(BaseModel):
    flights: list[dict[str, Any]] = Field(default_factory=list)
    segments: list[dict[str, Any]] = Field(default_factory=list)
    passenger_count: int = Field(default=1, ge=1)
    target_margin_pct: float = Field(default=25.0, ge=0)
    display_currency: str = "EUR"
    fx_rates_to_eur: dict[str, float] | None = None


class HybridTripResponse(BaseModel):
    trip_id: int
    flights: list[FlightResponse] = Field(default_factory=list)
    segments: list[SegmentResponse] = Field(default_factory=list)
    passenger_seats: list[dict[str, Any]] = Field(default_factory=list)
    luggage: list[dict[str, Any]] = Field(default_factory=list)
    cost_summary: dict[str, Any] = Field(default_factory=dict)
