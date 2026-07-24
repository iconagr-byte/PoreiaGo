"""Hybrid travel — flights, trip segments, luggage & flight status stubs."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "009_hybrid_flights_segments"
down_revision = "008_trip_coordinates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # trips may exist only via platform-schema.sql — ensure thin table for FKs/sync.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS trips (
            id SERIAL PRIMARY KEY,
            tenant_id UUID NOT NULL,
            total_seats INT NOT NULL DEFAULT 50,
            base_price NUMERIC(10,2) NOT NULL DEFAULT 0,
            title TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
        """
    )
    op.create_table(
        "flights",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("trip_id", sa.Integer(), nullable=False),
        sa.Column("flight_number", sa.String(32), nullable=False),
        sa.Column("airline", sa.String(120), nullable=False, server_default=""),
        sa.Column("departure_airport", sa.String(8), nullable=False),
        sa.Column("arrival_airport", sa.String(8), nullable=False),
        sa.Column("departure_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("arrival_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("pnr_code", sa.String(32), nullable=True),
        sa.Column("seats_allocated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_per_seat", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("total_cost", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="EUR"),
        sa.Column("status", sa.String(32), nullable=False, server_default="scheduled"),
        sa.Column("delay_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_flights_tenant_trip", "flights", ["tenant_id", "trip_id"])
    op.create_index("ix_flights_departure", "flights", ["departure_time"])
    op.create_index("ix_flights_pnr", "flights", ["pnr_code"])

    op.create_table(
        "trip_segments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("trip_id", sa.Integer(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("segment_type", sa.String(32), nullable=False),
        sa.Column("title", sa.String(255), nullable=False, server_default=""),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("flight_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("flights.id", ondelete="SET NULL"), nullable=True),
        sa.Column("vehicle_ref", sa.String(64), nullable=True),
        sa.Column("origin_label", sa.String(255), nullable=True),
        sa.Column("destination_label", sa.String(255), nullable=True),
        sa.Column("ground_cost", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="EUR"),
        sa.Column("metadata", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("tenant_id", "trip_id", "sequence", name="uq_trip_segments_sequence"),
    )
    op.create_index("ix_trip_segments_tenant_trip", "trip_segments", ["tenant_id", "trip_id"])
    op.create_index("ix_trip_segments_type", "trip_segments", ["segment_type"])

    op.create_table(
        "passenger_flight_seats",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("trip_id", sa.Integer(), nullable=False),
        sa.Column("flight_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("flights.id", ondelete="CASCADE"), nullable=False),
        sa.Column("booking_id", sa.String(64), nullable=True),
        sa.Column("passenger_name", sa.String(255), nullable=False),
        sa.Column("ground_seat", sa.String(32), nullable=True),
        sa.Column("flight_seat", sa.String(16), nullable=True),
        sa.Column("ticket_code", sa.String(64), nullable=True),
        sa.Column("pnr_code", sa.String(32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_passenger_flight_seats_trip", "passenger_flight_seats", ["tenant_id", "trip_id"])
    op.create_index("ix_passenger_flight_seats_flight", "passenger_flight_seats", ["flight_id"])

    op.create_table(
        "luggage_checkins",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("trip_id", sa.Integer(), nullable=False),
        sa.Column("booking_id", sa.String(64), nullable=True),
        sa.Column("passenger_name", sa.String(255), nullable=False),
        sa.Column("checkin_status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("luggage_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("luggage_notes", sa.Text(), nullable=True),
        sa.Column("checked_by", sa.String(120), nullable=True),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_luggage_checkins_trip", "luggage_checkins", ["tenant_id", "trip_id"])

    op.create_table(
        "flight_status_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("flight_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("flights.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(64), nullable=False, server_default="stub"),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("delay_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("suggested_pickup_adjustment_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("raw_payload", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_flight_status_events_flight", "flight_status_events", ["flight_id", "created_at"])

    for table in ("flights", "trip_segments", "passenger_flight_seats", "luggage_checkins", "flight_status_events"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_{table} ON {table}")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation_{table} ON {table}
            USING (tenant_id::text = current_setting('app.current_tenant', true))
            """
        )


def downgrade() -> None:
    for table in ("flight_status_events", "luggage_checkins", "passenger_flight_seats", "trip_segments", "flights"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_{table} ON {table}")
        op.drop_table(table)
