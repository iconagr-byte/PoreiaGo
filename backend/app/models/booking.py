"""Booking entity — tenant-scoped reservation."""

from __future__ import annotations

import enum
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantScopedMixin, TimestampMixin


class BookingStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PAID = "paid"
    CANCELLED = "cancelled"
    BOARDED = "boarded"
    REFUNDED = "refunded"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PARTIAL = "partial"
    PAID = "paid"


class Booking(Base, TimestampMixin, TenantScopedMixin):
    __tablename__ = "bookings"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    trip_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    customer_user_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reference_code: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    status: Mapped[BookingStatus] = mapped_column(
        Enum(BookingStatus, name="booking_status", native_enum=False),
        default=BookingStatus.PENDING,
        nullable=False,
        index=True,
    )
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="booking_payment_status", native_enum=False),
        default=PaymentStatus.PENDING,
        nullable=False,
        index=True,
    )
    seat_label: Mapped[str | None] = mapped_column(String(16), nullable=True)
    passenger_name: Mapped[str] = mapped_column(String(255), nullable=False)
    passenger_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    passenger_vat_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    total_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"), nullable=False)
    amount_eur: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    fiscal_mark: Mapped[str | None] = mapped_column(String(64), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="EUR", nullable=False)
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    tenant = relationship("Tenant", back_populates="bookings")
    fiscal_invoices = relationship(
        "FiscalInvoice",
        back_populates="booking",
        cascade="all, delete-orphan",
        order_by="FiscalInvoice.created_at",
    )

    def sync_payment_status(self) -> None:
        """Derive payment_status from total_price and amount_paid."""
        if self.amount_paid <= 0:
            self.payment_status = PaymentStatus.PENDING
        elif self.amount_paid >= self.total_price:
            self.payment_status = PaymentStatus.PAID
        else:
            self.payment_status = PaymentStatus.PARTIAL
