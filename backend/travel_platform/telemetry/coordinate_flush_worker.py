"""Background worker — flush buffered GPS points to trip_coordinates (PostGIS)."""

from __future__ import annotations

import asyncio
import json
import logging
import os
from uuid import UUID

from sqlalchemy import text

from travel_platform.telemetry.coordinate_buffer import drain_batch

logger = logging.getLogger(__name__)

FLUSH_INTERVAL_SEC = float(os.getenv("TELEMETRY_COORD_FLUSH_SEC", "15"))


def _as_uuid_or_none(value: object) -> str | None:
    """Driver/vehicle ids from Master QR / legacy JWTs are often not UUIDs."""
    if value is None:
        return None
    text_value = str(value).strip()
    if not text_value:
        return None
    try:
        return str(UUID(text_value))
    except (ValueError, TypeError, AttributeError):
        return None


async def flush_coordinates_batch() -> int:
    batch = drain_batch(limit=int(os.getenv("TELEMETRY_COORD_BATCH", "500")))
    if not batch:
        return 0

    try:
        from app.core.database import AsyncSessionLocal
    except ImportError:
        from database import AsyncSessionLocal

    inserted = 0
    async with AsyncSessionLocal() as session:
        for row in batch:
            try:
                await session.execute(
                    text(
                        """
                        INSERT INTO trip_coordinates (
                            tenant_id, trip_id, driver_id, vehicle_id,
                            recorded_at, speed_kmh, heading_deg, geom, raw_payload
                        ) VALUES (
                            CAST(:tenant_id AS uuid),
                            :trip_id,
                            CAST(:driver_id AS uuid),
                            CAST(:vehicle_id AS uuid),
                            :recorded_at,
                            :speed_kmh,
                            :heading_deg,
                            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326),
                            CAST(:raw_payload AS jsonb)
                        )
                        """,
                    ),
                    {
                        "tenant_id": row.tenant_id,
                        "trip_id": row.trip_id,
                        "driver_id": _as_uuid_or_none(row.driver_id),
                        "vehicle_id": _as_uuid_or_none(row.vehicle_id),
                        "recorded_at": row.recorded_at,
                        "speed_kmh": row.speed_kmh,
                        "heading_deg": row.heading_deg,
                        "lat": row.lat,
                        "lng": row.lng,
                        "raw_payload": json.dumps(row.raw, default=str),
                    },
                )
                inserted += 1
            except Exception as exc:
                logger.warning("trip_coordinates insert skipped: %s", exc)
        try:
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("trip_coordinates batch commit failed")
            return 0
    return inserted


async def coordinate_flush_loop() -> None:
    logger.info("trip_coordinates flush worker started (interval=%ss)", FLUSH_INTERVAL_SEC)
    while True:
        try:
            count = await flush_coordinates_batch()
            if count:
                logger.debug("Flushed %s trip_coordinates rows", count)
        except Exception:
            logger.exception("coordinate flush loop error")
        await asyncio.sleep(FLUSH_INTERVAL_SEC)


def start_coordinate_flush_worker() -> None:
    asyncio.create_task(coordinate_flush_loop())
