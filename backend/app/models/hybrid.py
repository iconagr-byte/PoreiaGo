"""Hybrid travel models — flights, trip segments, luggage & flight status."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantScopedMixin, TimestampMixin


class Flight(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "flights"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    trip_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    flight_number: Mapped[str] = mapped_column(String(32), nullable=False)
    airline: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    departure_airport: Mapped[str] = mapped_column(String(8), nullable=False)
    arrival_airport: Mapped[str] = mapped_column(String(8), nullable=False)
    departure_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    arrival_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    pnr_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    seats_allocated: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cost_per_seat: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    total_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="EUR")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="scheduled")
    delay_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class TripSegment(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "trip_segments"
    __table_args__ = (UniqueConstraint("tenant_id", "trip_id", "sequence", name="uq_trip_segments_sequence"),)

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    trip_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    segment_type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    flight_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("flights.id", ondelete="SET NULL"), nullable=True)
    vehicle_ref: Mapped[str | None] = mapped_column(String(64), nullable=True)
    origin_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    destination_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ground_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="EUR")
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)


class PassengerFlightSeat(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "passenger_flight_seats"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    trip_id: Mapped[int] = mapped_column(Integer, nullable=False)
    flight_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("flights.id", ondelete="CASCADE"), nullable=False)
    booking_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    passenger_name: Mapped[str] = mapped_column(String(255), nullable=False)
    ground_seat: Mapped[str | None] = mapped_column(String(32), nullable=True)
    flight_seat: Mapped[str | None] = mapped_column(String(16), nullable=True)
    ticket_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    pnr_code: Mapped[str | None] = mapped_column(String(32), nullable=True)


class LuggageCheckin(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "luggage_checkins"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    trip_id: Mapped[int] = mapped_column(Integer, nullable=False)
    booking_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    passenger_name: Mapped[str] = mapped_column(String(255), nullable=False)
    checkin_status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    luggage_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    luggage_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    checked_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class FlightStatusEvent(Base):
    __tablename__ = "flight_status_events"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    flight_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("flights.id", ondelete="CASCADE"), nullable=False)
    provider: Mapped[str] = mapped_column(String(64), nullable=False, default="stub")
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    delay_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    suggested_pickup_adjustment_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    raw_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
