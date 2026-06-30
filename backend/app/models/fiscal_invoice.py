"""Fiscal invoices — one booking may have multiple receipts (deposit + settlement)."""

from __future__ import annotations

import enum
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import Enum, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantScopedMixin, TimestampMixin


class FiscalInvoiceKind(str, enum.Enum):
    DOWN_PAYMENT = "down_payment"
    FINAL_SETTLEMENT = "final_settlement"
    FULL_PAYMENT = "full_payment"
    CREDIT_NOTE = "credit_note"


class FiscalInvoiceStatus(str, enum.Enum):
    PENDING = "pending"
    QUEUED = "queued"
    ISSUED = "issued"
    FAILED = "failed"


class FiscalInvoice(Base, TimestampMixin, TenantScopedMixin):
    __tablename__ = "fiscal_invoices"
    __table_args__ = (
        UniqueConstraint("stripe_payment_intent_id", name="uq_fiscal_invoices_stripe_pi"),
        UniqueConstraint("idempotency_key", name="uq_fiscal_invoices_idempotency"),
    )

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    booking_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    aade_submission_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("aade_submissions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    invoice_kind: Mapped[FiscalInvoiceKind] = mapped_column(
        Enum(FiscalInvoiceKind, name="fiscal_invoice_kind", native_enum=False),
        nullable=False,
    )
    status: Mapped[FiscalInvoiceStatus] = mapped_column(
        Enum(FiscalInvoiceStatus, name="fiscal_invoice_status", native_enum=False),
        default=FiscalInvoiceStatus.PENDING,
        nullable=False,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="EUR", nullable=False)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    aade_mark: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    booking = relationship("Booking", back_populates="fiscal_invoices")
    aade_submission = relationship("AadeSubmission", back_populates="fiscal_invoice")
