"""Known platform demo catalog — must not appear in production offices."""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

# Seed booking ids / reference codes from mockData + seed_saas_dev.
DEMO_BOOKING_REFS = frozenset(
    {
        "B-1029",
        "B-1030",
        "B-1031",
        "B-0995",
        "BK-1029",
        "BK-1030",
        "BK-1031",
        "BK-0995",
    }
)

DEMO_TRIP_TITLES = frozenset(
    {
        "Ημερήσια στα Μετέωρα",
        "Απόδραση στην Πρωτεύουσα",
        "Μαγευτικά Ιωάννινα",
        "3ήμερο Ναύπλιο",
        "Παρίσι — City of Light",
        "Ρώμη — La Dolce Vita",
    }
)

DEMO_PASSENGER_EMAILS = frozenset(
    {
        "john@example.com",
        "maria@example.com",
        "george@example.com",
    }
)


def is_demo_booking_ref(ref: str | None) -> bool:
    key = str(ref or "").strip().upper()
    return key in {r.upper() for r in DEMO_BOOKING_REFS}


def is_demo_trip_title(title: str | None) -> bool:
    return str(title or "").strip() in DEMO_TRIP_TITLES


def allow_demo_seeds() -> bool:
    """Demo seeds only outside production (or when explicitly forced)."""
    env = (os.getenv("ENVIRONMENT") or os.getenv("APP_ENV") or "").strip().lower()
    if env in ("production", "prod"):
        return False
    force = (os.getenv("ALLOW_DEMO_BOOKING_SEED") or "").strip().lower()
    return force in ("1", "true", "yes", "on") or env in ("development", "dev", "local", "test", "")


async def purge_seed_demo_bookings_sqlite() -> int:
    """Remove demo rows from ticketing + customer_bookings SQLite stores."""
    removed = 0
    try:
        from ticketing.db import get_db

        db = get_db()
        refs = [r.upper() for r in DEMO_BOOKING_REFS]
        placeholders = ",".join("?" for _ in refs)
        for table in ("ticket_bookings", "customer_bookings"):
            try:
                cur = await db.execute(
                    f"DELETE FROM {table} WHERE UPPER(id) IN ({placeholders})",
                    refs,
                )
                removed += int(getattr(cur, "rowcount", 0) or 0)
            except Exception:
                logger.debug("skip purge table %s", table, exc_info=True)
        try:
            await db.commit()
        except Exception:
            pass
    except Exception:
        logger.exception("Failed purging demo bookings from SQLite")
    return removed


async def purge_seed_demo_bookings_postgres() -> int:
    """Delete seeded demo bookings from Postgres by known reference codes."""
    removed = 0
    try:
        from sqlalchemy import delete, select

        from app.core.database import AsyncSessionLocal
        from app.models.booking import Booking

        refs = list(DEMO_BOOKING_REFS)
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Booking.id).where(Booking.reference_code.in_(refs))
            )
            ids = [row[0] for row in result.all()]
            if ids:
                await db.execute(delete(Booking).where(Booking.id.in_(ids)))
                await db.commit()
                removed = len(ids)
    except Exception:
        logger.exception("Failed purging demo bookings from Postgres")
    return removed


async def purge_seed_demo_catalog() -> dict:
    sqlite_n = await purge_seed_demo_bookings_sqlite()
    pg_n = await purge_seed_demo_bookings_postgres()
    if sqlite_n or pg_n:
        logger.info("Purged demo bookings: sqlite=%s postgres=%s", sqlite_n, pg_n)
    return {"sqlite": sqlite_n, "postgres": pg_n}
