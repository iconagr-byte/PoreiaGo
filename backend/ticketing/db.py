import json
from pathlib import Path
from contextlib import asynccontextmanager

import aiosqlite

from .config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS ticket_bookings (
    id TEXT PRIMARY KEY,
    trip_id INTEGER NOT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    ticket_ref TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    seat_number TEXT NOT NULL,
    payment_status TEXT NOT NULL,
    check_in_status TEXT NOT NULL DEFAULT 'NONE',
    special_requirements TEXT,
    phone TEXT,
    departure_at TEXT NOT NULL,
    last_scan_step INTEGER,
    boarded_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    saas_booking_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_tb_trip ON ticket_bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_tb_ref ON ticket_bookings(ticket_ref);
CREATE INDEX IF NOT EXISTS idx_tb_status ON ticket_bookings(trip_id, check_in_status);
CREATE INDEX IF NOT EXISTS idx_tb_saas ON ticket_bookings(saas_booking_id);

CREATE TABLE IF NOT EXISTS customer_accounts (
    email TEXT PRIMARY KEY,
    password_hash TEXT,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT,
    picture TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'email',
    customer_id TEXT,
    reset_token TEXT,
    reset_expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ca_reset ON customer_accounts(reset_token);

CREATE TABLE IF NOT EXISTS customer_bookings (
    id TEXT PRIMARY KEY,
    customer_email TEXT NOT NULL,
    customer_id TEXT,
    payload_json TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cb_email ON customer_bookings(customer_email);
CREATE INDEX IF NOT EXISTS idx_cb_customer ON customer_bookings(customer_id);

CREATE TABLE IF NOT EXISTS lost_items (
    id TEXT PRIMARY KEY,
    customer_email TEXT NOT NULL,
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    item_category TEXT NOT NULL,
    description TEXT NOT NULL,
    last_seen_location TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    date_reported TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lost_email ON lost_items(customer_email);
CREATE INDEX IF NOT EXISTS idx_lost_status ON lost_items(status);
"""

_db: aiosqlite.Connection | None = None


async def init_ticketing_db() -> None:
    global _db
    path = Path(settings.sqlite_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    _db = await aiosqlite.connect(path)
    _db.row_factory = aiosqlite.Row
    await _db.executescript(SCHEMA)
    try:
        await _db.execute("ALTER TABLE ticket_bookings ADD COLUMN saas_booking_id TEXT")
    except Exception:
        pass
    await _db.commit()


async def close_ticketing_db() -> None:
    global _db
    if _db:
        await _db.close()
        _db = None


def get_db() -> aiosqlite.Connection:
    if _db is None:
        raise RuntimeError("Ticketing DB not initialized")
    return _db


@asynccontextmanager
async def transaction():
    db = get_db()
    try:
        await db.execute("BEGIN IMMEDIATE")
        yield db
        await db.commit()
    except Exception:
        await db.rollback()
        raise


def row_to_booking(row: aiosqlite.Row) -> dict:
    spec = row["special_requirements"]
    return {
        "id": row["id"],
        "trip_id": row["trip_id"],
        "tenant_id": row["tenant_id"],
        "ticket_ref": row["ticket_ref"],
        "customer_name": row["customer_name"],
        "seat_number": row["seat_number"],
        "payment_status": row["payment_status"],
        "check_in_status": row["check_in_status"],
        "special_requirements": json.loads(spec) if spec else {},
        "phone": row["phone"],
        "departure_at": row["departure_at"],
        "last_scan_step": row["last_scan_step"],
        "boarded_at": row["boarded_at"],
        "saas_booking_id": row["saas_booking_id"] if "saas_booking_id" in row.keys() else None,
    }
