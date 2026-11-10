"""Fleet rental ORM models (Postgres / Alembic 011)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantScopedMixin, TimestampMixin


class RentalVehicle(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "rental_vehicles"
    __table_args__ = (UniqueConstraint("tenant_id", "plate_number", name="uq_rental_vehicles_tenant_plate"),)

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    plate_number: Mapped[str] = mapped_column(String(32), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    model: Mapped[str] = mapped_column(String(120), nullable=False)
    year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    seating_capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    current_status: Mapped[str] = mapped_column(String(32), nullable=False, default="AVAILABLE")
    current_mileage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    daily_rate_eur: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    one_way_surcharge_eur: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    with_driver_daily_eur: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    gps_device_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    photo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    photo_urls: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class RentalBooking(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "rental_bookings"
    __table_args__ = (CheckConstraint("end_time > start_time", name="ck_rental_bookings_time_range"),)

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    vehicle_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rental_vehicles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    client_id: Mapped[Optional[UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    client_name: Mapped[str] = mapped_column(String(160), nullable=False)
    client_email: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    client_phone: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    pickup_location: Mapped[str] = mapped_column(String(240), nullable=False)
    dropoff_location: Mapped[str] = mapped_column(String(240), nullable=False)
    total_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    rental_status: Mapped[str] = mapped_column(String(32), nullable=False, default="CONFIRMED")
    driver_mode: Mapped[str] = mapped_column(String(32), nullable=False, default="SELF_DRIVE")
    assigned_driver_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class VehicleInspection(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "vehicle_inspections"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    rental_booking_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rental_bookings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    inspection_type: Mapped[str] = mapped_column(String(32), nullable=False)
    fuel_level: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=100)
    mileage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    damage_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    photo_urls: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    signature_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    inspector_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
