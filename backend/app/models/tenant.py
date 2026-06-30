"""Tenant (organization) — root of multi-tenant isolation."""

from __future__ import annotations

import enum
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Enum, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class TenantPlan(str, enum.Enum):
    STARTER = "starter"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"


class Tenant(Base, TimestampMixin):
    __tablename__ = "tenants"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    legal_name: Mapped[str] = mapped_column(String(255), nullable=False)
    vat_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    subdomain: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    custom_domain: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    plan: Mapped[TenantPlan] = mapped_column(
        Enum(TenantPlan, name="tenant_plan", native_enum=False),
        default=TenantPlan.STARTER,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True, index=True)
    settings_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    isolation_strategy: Mapped[str] = mapped_column(String(32), default="shared_rls", nullable=False)
    database_dsn: Mapped[str | None] = mapped_column(Text, nullable=True)
    theme_config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    admin_ip_whitelist: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    suspended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    suspended_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    users = relationship("User", back_populates="tenant", lazy="selectin")
    bookings = relationship("Booking", back_populates="tenant", lazy="selectin")
    subscription = relationship(
        "Subscription",
        back_populates="tenant",
        uselist=False,
        lazy="selectin",
    )
