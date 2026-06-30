"""Geographic stop for route geofencing (PostGIS)."""

from __future__ import annotations

from uuid import uuid4

from geoalchemy2 import Geography
from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantScopedMixin, TimestampMixin


class Stop(Base, TimestampMixin, TenantScopedMixin):
    __tablename__ = "stops"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    trip_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    location = mapped_column(
        Geography(geometry_type="POINT", srid=4326),
        nullable=False,
    )
