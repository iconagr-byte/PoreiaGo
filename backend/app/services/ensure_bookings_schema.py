"""Heal bookings (+ fiscal_invoices) schema drift when Contabo DBs lag Alembic.

Production often has a `bookings` table from an older bootstrap while ORM/migrations
expect columns from 001/002/007/015 (notably `customer_user_id`, payment fields).
Alembic upgrade can fail earlier (e.g. DuplicateColumn on tenants), so cash capture
then dies with UndefinedColumnError.

Safe to call on every API boot — uses IF NOT EXISTS / idempotent DDL.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# One statement per execute — asyncpg rejects multi-command prepared statements.
_HEAL_STATEMENTS: tuple[str, ...] = (
    "ALTER TABLE IF EXISTS bookings ADD COLUMN IF NOT EXISTS customer_user_id UUID",
    "ALTER TABLE IF EXISTS bookings ADD COLUMN IF NOT EXISTS passenger_vat_id VARCHAR(32)",
    "ALTER TABLE IF EXISTS bookings ADD COLUMN IF NOT EXISTS fiscal_mark VARCHAR(64)",
    "ALTER TABLE IF EXISTS bookings ADD COLUMN IF NOT EXISTS total_price NUMERIC(12, 2)",
    (
        "ALTER TABLE IF EXISTS bookings "
        "ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0"
    ),
    (
        "ALTER TABLE IF EXISTS bookings "
        "ADD COLUMN IF NOT EXISTS payment_status VARCHAR(16) NOT NULL DEFAULT 'pending'"
    ),
    "ALTER TABLE IF EXISTS bookings ADD COLUMN IF NOT EXISTS seat_label VARCHAR(128)",
    "ALTER TABLE IF EXISTS bookings ADD COLUMN IF NOT EXISTS trip_id UUID",
    "ALTER TABLE IF EXISTS bookings ADD COLUMN IF NOT EXISTS reference_code VARCHAR(32)",
    "ALTER TABLE IF EXISTS bookings ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'pending'",
    "ALTER TABLE IF EXISTS bookings ADD COLUMN IF NOT EXISTS passenger_name VARCHAR(255)",
    "ALTER TABLE IF EXISTS bookings ADD COLUMN IF NOT EXISTS passenger_email VARCHAR(320)",
    "ALTER TABLE IF EXISTS bookings ADD COLUMN IF NOT EXISTS amount_eur NUMERIC(12, 2)",
    (
        "ALTER TABLE IF EXISTS bookings "
        "ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'EUR'"
    ),
    "ALTER TABLE IF EXISTS bookings ADD COLUMN IF NOT EXISTS metadata_json JSONB",
    "ALTER TABLE IF EXISTS bookings ADD COLUMN IF NOT EXISTS notes TEXT",
    # TimestampMixin — Contabo bootstrap tables often only have created_at.
    (
        "ALTER TABLE IF EXISTS bookings "
        "ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()"
    ),
    (
        "ALTER TABLE IF EXISTS bookings "
        "ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()"
    ),
    """
    UPDATE bookings
    SET updated_at = COALESCE(updated_at, created_at, now())
    WHERE updated_at IS NULL
    """,
    """
    UPDATE bookings
    SET total_price = COALESCE(total_price, amount_eur, amount_paid, 0)
    WHERE total_price IS NULL
    """,
    """
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bookings'
          AND column_name = 'seat_label'
      ) THEN
        ALTER TABLE bookings ALTER COLUMN seat_label TYPE VARCHAR(128);
      END IF;
    END $$
    """,
    "CREATE INDEX IF NOT EXISTS ix_bookings_payment_status ON bookings (payment_status)",
    """
    CREATE TABLE IF NOT EXISTS fiscal_invoices (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        booking_id UUID NOT NULL,
        aade_submission_id UUID,
        invoice_kind VARCHAR(32) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        amount NUMERIC(12, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
        stripe_payment_intent_id VARCHAR(128),
        idempotency_key VARCHAR(128) NOT NULL,
        aade_mark VARCHAR(64),
        error_message TEXT,
        metadata_json JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    (
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_fiscal_invoices_idempotency "
        "ON fiscal_invoices (idempotency_key)"
    ),
    "CREATE INDEX IF NOT EXISTS ix_fiscal_invoices_tenant_id ON fiscal_invoices (tenant_id)",
    "CREATE INDEX IF NOT EXISTS ix_fiscal_invoices_booking_id ON fiscal_invoices (booking_id)",
    "CREATE INDEX IF NOT EXISTS ix_fiscal_invoices_status ON fiscal_invoices (status)",
)

_healed = False


def reset_bookings_schema_heal_flag() -> None:
    """Test helper — allow ensure to run again in-process."""
    global _healed
    _healed = False


async def ensure_bookings_schema(session: AsyncSession, *, force: bool = False) -> bool:
    """Add missing bookings columns / fiscal_invoices. Returns True on success."""
    global _healed
    if _healed and not force:
        return True
    try:
        for stmt in _HEAL_STATEMENTS:
            await session.execute(text(stmt))
        await session.commit()
        _healed = True
        logger.info(
            "Bookings schema healed "
            "(customer_user_id / payment / updated_at / fiscal_invoices)"
        )
        return True
    except Exception as exc:
        await session.rollback()
        logger.warning("Bookings schema ensure failed: %s", exc)
        return False


def is_bookings_schema_drift_error(exc: BaseException) -> bool:
    """True when Postgres/SQLAlchemy reports missing bookings columns."""
    msg = f"{exc.__class__.__name__}: {exc}".lower()
    if "undefinedcolumn" in msg or "does not exist" in msg:
        if "bookings." in msg or "column bookings" in msg or "customer_user_id" in msg:
            return True
        if "payment_status" in msg or "amount_paid" in msg or "total_price" in msg:
            return True
        if "updated_at" in msg or "created_at" in msg:
            return True
    return False


async def ensure_bookings_schema_best_effort(session: Any | None = None) -> bool:
    """Open a session if needed and heal. Never raises."""
    if session is not None:
        try:
            return await ensure_bookings_schema(session, force=True)
        except Exception:
            logger.exception("Bookings schema heal via provided session failed")
            return False
    try:
        from app.core.database import AsyncSessionLocal

        async with AsyncSessionLocal() as db:
            return await ensure_bookings_schema(db, force=True)
    except Exception:
        logger.exception("Bookings schema heal bootstrap failed")
        return False
