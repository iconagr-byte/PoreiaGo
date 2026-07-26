"""Fleet rental module — vehicles, bookings, inspections."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "011_fleet_rental"
down_revision = "010_hybrid_prod_hardening"
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
    op.create_table(
        "rental_vehicles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("plate_number", sa.String(32), nullable=False),
        sa.Column("category", sa.String(32), nullable=False),
        sa.Column("model", sa.String(120), nullable=False),
        sa.Column("seating_capacity", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("current_status", sa.String(32), nullable=False, server_default="AVAILABLE"),
        sa.Column("current_mileage", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("daily_rate_eur", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("gps_device_id", sa.String(64), nullable=True),
        sa.Column("photo_url", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("tenant_id", "plate_number", name="uq_rental_vehicles_tenant_plate"),
    )
    op.create_index("ix_rental_vehicles_tenant", "rental_vehicles", ["tenant_id"])
    op.create_index("ix_rental_vehicles_status", "rental_vehicles", ["tenant_id", "current_status"])
    op.create_index("ix_rental_vehicles_category", "rental_vehicles", ["tenant_id", "category"])
    _rls("rental_vehicles")

    op.create_table(
        "rental_bookings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "vehicle_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("rental_vehicles.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("client_name", sa.String(160), nullable=False),
        sa.Column("client_email", sa.String(200), nullable=True),
        sa.Column("client_phone", sa.String(40), nullable=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("pickup_location", sa.String(240), nullable=False),
        sa.Column("dropoff_location", sa.String(240), nullable=False),
        sa.Column("total_cost", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("rental_status", sa.String(32), nullable=False, server_default="CONFIRMED"),
        sa.Column("driver_mode", sa.String(32), nullable=False, server_default="SELF_DRIVE"),
        sa.Column("assigned_driver_id", sa.String(64), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("end_time > start_time", name="ck_rental_bookings_time_range"),
    )
    op.create_index("ix_rental_bookings_tenant", "rental_bookings", ["tenant_id"])
    op.create_index("ix_rental_bookings_vehicle_time", "rental_bookings", ["vehicle_id", "start_time", "end_time"])
    op.create_index("ix_rental_bookings_status", "rental_bookings", ["tenant_id", "rental_status"])
    _rls("rental_bookings")

    op.create_table(
        "vehicle_inspections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "rental_booking_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("rental_bookings.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("inspection_type", sa.String(32), nullable=False),
        sa.Column("fuel_level", sa.Numeric(5, 2), nullable=False, server_default="100"),
        sa.Column("mileage", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("damage_notes", sa.Text(), nullable=True),
        sa.Column("photo_urls", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("signature_url", sa.Text(), nullable=True),
        sa.Column("inspector_name", sa.String(120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_vehicle_inspections_tenant", "vehicle_inspections", ["tenant_id"])
    op.create_index("ix_vehicle_inspections_booking", "vehicle_inspections", ["rental_booking_id"])
    _rls("vehicle_inspections")


def downgrade() -> None:
    for table in ("vehicle_inspections", "rental_bookings", "rental_vehicles"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_{table} ON {table}")
        op.drop_table(table)
