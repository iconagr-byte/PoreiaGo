"""AADE / myDATA submission tracking."""

from __future__ import annotations

import enum
from uuid import uuid4

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantScopedMixin, TimestampMixin


class AadeSubmissionStatus(str, enum.Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    FAILED = "failed"


class AadeSubmission(Base, TimestampMixin, TenantScopedMixin):
    __tablename__ = "aade_submissions"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    booking_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    status: Mapped[AadeSubmissionStatus] = mapped_column(
        Enum(AadeSubmissionStatus, name="aade_submission_status", native_enum=False),
        default=AadeSubmissionStatus.QUEUED,
        nullable=False,
        index=True,
    )
    mark: Mapped[str | None] = mapped_column(String(64), nullable=True)
    aade_uid: Mapped[str | None] = mapped_column(String(128), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    webhook_received_at: Mapped[str | None] = mapped_column(String(64), nullable=True)

    fiscal_invoice = relationship("FiscalInvoice", back_populates="aade_submission", uselist=False)
