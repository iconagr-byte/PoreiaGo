"""Historical GPS trail points — PostGIS Point 4326."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from geoalchemy2 import Geometry
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantScopedMixin, TimestampMixin


class TripCoordinate(Base, TimestampMixin, TenantScopedMixin):
    __tablename__ = "trip_coordinates"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tenant_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    trip_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    driver_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    vehicle_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    speed_kmh: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    heading_deg: Mapped[float | None] = mapped_column(Float, nullable=True)
    geom = mapped_column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    raw_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
