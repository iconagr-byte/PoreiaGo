"""Sync frontend trip records into Postgres `trips` + durable per-tenant catalog."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from sqlalchemy import text

from travel_platform.operations.master_qr_bridge import default_tenant_id, saas_db_available
from travel_platform.operations.tenant_trip_catalog_store import upsert_tenant_trips
from travel_platform.operations.trip_ops_store import upsert_trip_ops_batch

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
        "destination": str(raw.get("destination") or "").strip(),
        "meeting_point": str(raw.get("meeting_point") or raw.get("meetingPoint") or "").strip(),
        "departure_time": str(raw.get("departure_time") or raw.get("departureTime") or "").strip(),
        "arrival_time": str(raw.get("arrival_time") or raw.get("arrivalTime") or "").strip(),
        "stops": raw.get("stops") if isinstance(raw.get("stops"), list) else [],
        "segments": raw.get("segments") if isinstance(raw.get("segments"), list) else [],
        # Storefront / catalog fields (forwarded as-is when present)
        "availableSeats": raw.get("availableSeats") or raw.get("available_seats"),
        "totalSeats": raw.get("totalSeats") or raw.get("total_seats") or total_seats,
        "description": raw.get("description"),
        "image": raw.get("image") or raw.get("image_url"),
        "hook": raw.get("hook"),
        "durationLabel": raw.get("durationLabel") or raw.get("duration_label"),
        "badge": raw.get("badge"),
        "featured": raw.get("featured"),
        "status": raw.get("status"),
        "meetingPoint": raw.get("meetingPoint") or raw.get("meeting_point"),
        "highlights": raw.get("highlights") if isinstance(raw.get("highlights"), list) else [],
        "market": raw.get("market"),
        "vehicleType": raw.get("vehicleType") or raw.get("vehicle_type"),
        "currency": raw.get("currency"),
        "childPrice": raw.get("childPrice") or raw.get("child_price"),
        "departureTime": raw.get("departureTime") or raw.get("departure_time"),
        "arrivalTime": raw.get("arrivalTime") or raw.get("arrival_time"),
        "price": price,
    }


async def sync_trips_to_postgres(
    trips: list[dict[str, Any]],
    *,
    tenant_id: str | None = None,
    replace_catalog: bool = False,
) -> dict[str, Any]:
    if not trips:
        available = await saas_db_available()
        return {"synced": 0, "skipped": 0, "postgres_available": available}

    tid = (tenant_id or "").strip() or default_tenant_id()
    if not (tenant_id or "").strip():
        logger.warning(
            "trips sync called without tenant_id — falling back to default tenant %s",
            tid,
        )

    synced = 0
    skipped = 0
    stolen_blocked = 0
    ops_saved = 0
    catalog_saved = 0

    ops_items: list[tuple[int, dict[str, Any]]] = []
    catalog_rows: list[dict[str, Any]] = []
    for raw in trips:
        row = _normalize_trip_row(raw if isinstance(raw, dict) else dict(raw))
        if not row:
            skipped += 1
            continue
        ops_items.append((row["id"], row))
        catalog_rows.append(row if isinstance(raw, dict) else row)
        # Prefer original raw for richer storefront fields when present.
        if isinstance(raw, dict):
            catalog_rows[-1] = {**row, **raw, "id": row["id"]}

    try:
        ops_saved = await asyncio.to_thread(upsert_trip_ops_batch, ops_items)
    except Exception as exc:
        logger.warning("trip ops batch upsert failed: %s", exc)
        ops_saved = 0

    try:
        if replace_catalog:
            from travel_platform.operations.tenant_trip_catalog_store import (
                replace_tenant_catalog,
            )

            catalog_saved = await asyncio.to_thread(replace_tenant_catalog, tid, catalog_rows)
        else:
            catalog_saved = await asyncio.to_thread(upsert_tenant_trips, tid, catalog_rows)
    except Exception as exc:
        logger.warning("tenant trip catalog upsert failed: %s", exc)
        catalog_saved = 0

    if not await saas_db_available():
        return {
            "synced": catalog_saved or ops_saved,
            "skipped": skipped,
            "postgres_available": False,
            "ops_saved": ops_saved,
            "catalog_saved": catalog_saved,
            "tenant_id": tid,
        }

    from uuid import UUID

    from database import AsyncSessionLocal
    from middleware.tenant import apply_tenant_to_session

    async with AsyncSessionLocal() as session:
        uid = UUID(tid)
        await apply_tenant_to_session(session, uid)
        for raw in trips:
            row = _normalize_trip_row(raw if isinstance(raw, dict) else dict(raw))
            if not row:
                continue
            # Never steal another tenant's trip id.
            existing = await session.execute(
                text("SELECT tenant_id FROM trips WHERE id = :id"),
                {"id": row["id"]},
            )
            owner = existing.scalar_one_or_none()
            if owner is not None and str(owner) != tid:
                stolen_blocked += 1
                logger.warning(
                    "Blocked trip id=%s sync for tenant=%s — owned by %s",
                    row["id"],
                    tid,
                    owner,
                )
                continue

            await session.execute(
                text("""
                    INSERT INTO trips (id, tenant_id, total_seats, base_price, title)
                    VALUES (:id, :tenant, :seats, :price, :title)
                    ON CONFLICT (id) DO UPDATE SET
                        total_seats = EXCLUDED.total_seats,
                        base_price = EXCLUDED.base_price,
                        title = EXCLUDED.title
                    WHERE trips.tenant_id = EXCLUDED.tenant_id
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

    logger.info(
        "Synced %s trips to Postgres + %s ops + %s catalog (tenant=%s, skipped=%s, blocked=%s)",
        synced,
        ops_saved,
        catalog_saved,
        tid,
        skipped,
        stolen_blocked,
    )
    return {
        "synced": synced,
        "skipped": skipped + stolen_blocked,
        "postgres_available": True,
        "ops_saved": ops_saved,
        "catalog_saved": catalog_saved,
        "tenant_id": tid,
    }
