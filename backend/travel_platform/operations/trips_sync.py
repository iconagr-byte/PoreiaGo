"""Sync frontend trip records into Postgres `trips` (same numeric id as localStorage)."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import text

from travel_platform.operations.master_qr_bridge import default_tenant_id, saas_db_available

logger = logging.getLogger(__name__)


def _normalize_trip_row(raw: dict[str, Any]) -> dict[str, Any] | None:
    try:
        trip_id = int(raw.get("id"))
    except (TypeError, ValueError):
        return None
    if trip_id <= 0:
        return None

    title = str(raw.get("title") or "").strip()[:500]
    price = float(raw.get("price") or raw.get("base_price") or 0)

    total_seats = raw.get("total_seats") or raw.get("totalSeats") or raw.get("capacity")
    if total_seats is None:
        avail = raw.get("available_seats") or raw.get("availableSeats")
        try:
            total_seats = max(int(avail or 0) + 15, 45)
        except (TypeError, ValueError):
            total_seats = 50
    try:
        total_seats = max(int(total_seats), 1)
    except (TypeError, ValueError):
        total_seats = 50

    return {
        "id": trip_id,
        "title": title or f"Trip #{trip_id}",
        "total_seats": total_seats,
        "base_price": max(price, 0),
    }


async def sync_trips_to_postgres(
    trips: list[dict[str, Any]],
    *,
    tenant_id: str | None = None,
) -> dict[str, Any]:
    if not trips:
        available = await saas_db_available()
        return {"synced": 0, "skipped": 0, "postgres_available": available}

    if not await saas_db_available():
        return {"synced": 0, "skipped": len(trips), "postgres_available": False}

    from uuid import UUID

    from database import AsyncSessionLocal
    from middleware.tenant import apply_tenant_to_session

    tid = tenant_id or default_tenant_id()
    synced = 0
    skipped = 0

    async with AsyncSessionLocal() as session:
        uid = UUID(tid)
        await apply_tenant_to_session(session, uid)
        for raw in trips:
            row = _normalize_trip_row(raw if isinstance(raw, dict) else dict(raw))
            if not row:
                skipped += 1
                continue
            await session.execute(
                text("""
                    INSERT INTO trips (id, tenant_id, total_seats, base_price, title)
                    VALUES (:id, :tenant, :seats, :price, :title)
                    ON CONFLICT (id) DO UPDATE SET
                        tenant_id = EXCLUDED.tenant_id,
                        total_seats = EXCLUDED.total_seats,
                        base_price = EXCLUDED.base_price,
                        title = EXCLUDED.title
                """),
                {
                    "id": row["id"],
                    "tenant": tid,
                    "seats": row["total_seats"],
                    "price": row["base_price"],
                    "title": row["title"],
                },
            )
            synced += 1

        await session.execute(
            text(
                "SELECT setval("
                "pg_get_serial_sequence('trips', 'id'), "
                "GREATEST((SELECT COALESCE(MAX(id), 1) FROM trips), 1), "
                "true)"
            )
        )
        await session.commit()

    logger.info("Synced %s trips to Postgres (tenant=%s, skipped=%s)", synced, tid, skipped)
    return {
        "synced": synced,
        "skipped": skipped,
        "postgres_available": True,
        "tenant_id": tid,
    }
