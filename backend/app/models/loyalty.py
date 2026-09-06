"""Miles+Bonus loyalty ORM (Alembic 014)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantScopedMixin, TimestampMixin


LOYALTY_TIERS = ("STANDARD", "SILVER", "GOLD", "PLATINUM")
MILES_TX_TYPES = ("EARN", "REDEEM", "ADJUST", "EXPIRE")


class LoyaltyAccount(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "loyalty_accounts"
    __table_args__ = (
        UniqueConstraint("tenant_id", "client_email", name="uq_loyalty_accounts_tenant_email"),
    )

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    client_id: Mapped[Optional[UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    client_email: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    lifetime_miles: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    redeemable_miles: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    tier: Mapped[str] = mapped_column(String(32), nullable=False, default="STANDARD")


class MilesTransaction(Base, TenantScopedMixin):
    __tablename__ = "miles_transactions"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    loyalty_account_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("loyalty_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tx_type: Mapped[str] = mapped_column(String(32), nullable=False)
    miles: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    source_kind: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    source_id: Mapped[Optional[UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    distance_km: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 3), nullable=True)
    multiplier: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False, default=1)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
