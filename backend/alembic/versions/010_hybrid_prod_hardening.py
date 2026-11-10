"""Hybrid hardening — nullable flight_id, trip meta JSON, indexes."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "010_hybrid_prod_hardening"
down_revision = "009_hybrid_flights_segments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Allow ground-only manifest rows before a flight is linked.
    op.execute("ALTER TABLE passenger_flight_seats ALTER COLUMN flight_id DROP NOT NULL")

    op.create_table(
        "hybrid_trip_meta",
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("trip_id", sa.Integer(), primary_key=True),
        sa.Column("rooming_list", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("passenger_extras", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column(
            "supplier_cost_sheets",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("crew", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column(
            "airport_buffers",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("currency", sa.String(3), nullable=False, server_default="EUR"),
        sa.Column("target_margin_pct", sa.Numeric(6, 2), nullable=False, server_default="25"),
        sa.Column("connection_threshold_min", sa.Integer(), nullable=False, server_default="90"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_hybrid_trip_meta_trip", "hybrid_trip_meta", ["trip_id"])

    op.execute("ALTER TABLE hybrid_trip_meta ENABLE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_hybrid_trip_meta ON hybrid_trip_meta")
    op.execute(
        """
        CREATE POLICY tenant_isolation_hybrid_trip_meta ON hybrid_trip_meta
        USING (tenant_id::text = current_setting('app.current_tenant', true))
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation_hybrid_trip_meta ON hybrid_trip_meta")
    op.drop_table("hybrid_trip_meta")
    # Keep flight_id nullable on downgrade to avoid data loss.
