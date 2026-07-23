"""Ensure PostGIS trip_coordinates exists (GPS history / Fleet KPIs).

Safe to call on every API boot — uses IF NOT EXISTS. Complements Alembic 008.
"""

from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

_ENSURE_SQL = """
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS trip_coordinates (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    trip_id INTEGER,
    driver_id UUID,
    vehicle_id UUID,
    recorded_at TIMESTAMPTZ NOT NULL,
    speed_kmh DOUBLE PRECISION NOT NULL DEFAULT 0,
    heading_deg DOUBLE PRECISION,
    geom geometry(POINT, 4326) NOT NULL,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_trip_coordinates_tenant_time
    ON trip_coordinates (tenant_id, recorded_at);
CREATE INDEX IF NOT EXISTS ix_trip_coordinates_trip_time
    ON trip_coordinates (trip_id, recorded_at);
CREATE INDEX IF NOT EXISTS ix_trip_coordinates_geom
    ON trip_coordinates USING GIST (geom);
"""


async def ensure_trip_coordinates_schema(session: AsyncSession) -> bool:
    """Create trip_coordinates (+ PostGIS) when missing. Returns True on success."""
    try:
        # tenants FK may not exist yet on brand-new DBs — fall back without FK.
        await session.execute(text(_ENSURE_SQL))
        await session.commit()
        logger.info("GPS schema ready (trip_coordinates)")
        return True
    except Exception as exc:
        await session.rollback()
        logger.warning("trip_coordinates ensure with FK failed (%s) — retry without FK", exc)

    fallback = """
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE TABLE IF NOT EXISTS trip_coordinates (
        id BIGSERIAL PRIMARY KEY,
        tenant_id UUID NOT NULL,
        trip_id INTEGER,
        driver_id UUID,
        vehicle_id UUID,
        recorded_at TIMESTAMPTZ NOT NULL,
        speed_kmh DOUBLE PRECISION NOT NULL DEFAULT 0,
        heading_deg DOUBLE PRECISION,
        geom geometry(POINT, 4326) NOT NULL,
        raw_payload JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ix_trip_coordinates_tenant_time
        ON trip_coordinates (tenant_id, recorded_at);
    CREATE INDEX IF NOT EXISTS ix_trip_coordinates_trip_time
        ON trip_coordinates (trip_id, recorded_at);
    CREATE INDEX IF NOT EXISTS ix_trip_coordinates_geom
        ON trip_coordinates USING GIST (geom);
    """
    try:
        await session.execute(text(fallback))
        await session.commit()
        logger.info("GPS schema ready (trip_coordinates, no FK)")
        return True
    except Exception as exc:
        await session.rollback()
        logger.warning("GPS schema ensure failed: %s", exc)
        return False
