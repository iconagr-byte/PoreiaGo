"""Enterprise foundation — rental align + Miles+Bonus loyalty.

Revision ID: 014_enterprise_foundation
Revises: 013_rental_vehicle_media
Create Date: 2026-07-30
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "014_enterprise_foundation"
down_revision = "013_rental_vehicle_media"
branch_labels = None
depends_on = None


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"DROP POLICY IF EXISTS tenant_isolation_{table} ON {table}")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation_{table} ON {table}
        USING (tenant_id::text = current_setting('app.current_tenant', true))
        """
    )


def upgrade() -> None:
    op.add_column(
        "rental_vehicles",
        sa.Column("year", sa.Integer(), nullable=True),
    )

    # Compatibility alias for master-prompt naming (rental_contracts).
    op.execute(
        """
        CREATE OR REPLACE VIEW rental_contracts AS
        SELECT
            id,
            tenant_id,
            vehicle_id,
            client_id,
            start_time AS start_datetime,
            end_time AS end_datetime,
            pickup_location,
            dropoff_location,
            total_cost AS total_price,
            rental_status AS contract_status,
            client_name,
            client_email,
            client_phone,
            driver_mode,
            assigned_driver_id,
            notes,
            created_at,
            updated_at
        FROM rental_bookings
        """
    )

    op.create_table(
        "loyalty_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("client_email", sa.String(200), nullable=True),
        sa.Column("display_name", sa.String(160), nullable=True),
        sa.Column("lifetime_miles", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("redeemable_miles", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("tier", sa.String(32), nullable=False, server_default="STANDARD"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("tenant_id", "client_email", name="uq_loyalty_accounts_tenant_email"),
    )
    op.create_index("ix_loyalty_accounts_tenant", "loyalty_accounts", ["tenant_id"])
    op.create_index("ix_loyalty_accounts_client", "loyalty_accounts", ["tenant_id", "client_id"])
    op.create_index("ix_loyalty_accounts_tier", "loyalty_accounts", ["tenant_id", "tier"])
    _rls("loyalty_accounts")

    op.create_table(
        "miles_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "loyalty_account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("loyalty_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tx_type", sa.String(32), nullable=False),
        sa.Column("miles", sa.Numeric(14, 2), nullable=False),
        sa.Column("balance_after", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("source_kind", sa.String(32), nullable=True),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("distance_km", sa.Numeric(12, 3), nullable=True),
        sa.Column("multiplier", sa.Numeric(8, 4), nullable=False, server_default="1"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("miles <> 0", name="ck_miles_transactions_nonzero"),
    )
    op.create_index("ix_miles_transactions_tenant", "miles_transactions", ["tenant_id"])
    op.create_index(
        "ix_miles_transactions_account",
        "miles_transactions",
        ["loyalty_account_id", "created_at"],
    )
    op.create_index(
        "ix_miles_transactions_source",
        "miles_transactions",
        ["tenant_id", "source_kind", "source_id"],
    )
    _rls("miles_transactions")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS miles_transactions CASCADE")
    op.execute("DROP TABLE IF EXISTS loyalty_accounts CASCADE")
    op.execute("DROP VIEW IF EXISTS rental_contracts")
    op.drop_column("rental_vehicles", "year")
