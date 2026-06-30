"""trip_coordinates — PostGIS historical route playback."""

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry

revision = "008_trip_coordinates"
down_revision = "007_booking_partial_payments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.create_table(
        "trip_coordinates",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("trip_id", sa.Integer(), nullable=True),
        sa.Column("driver_id", sa.UUID(), nullable=True),
        sa.Column("vehicle_id", sa.UUID(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("speed_kmh", sa.Float(), nullable=False, server_default="0"),
        sa.Column("heading_deg", sa.Float(), nullable=True),
        sa.Column("geom", Geometry(geometry_type="POINT", srid=4326), nullable=False),
        sa.Column("raw_payload", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_trip_coordinates_tenant_time", "trip_coordinates", ["tenant_id", "recorded_at"])
    op.create_index("ix_trip_coordinates_trip_time", "trip_coordinates", ["trip_id", "recorded_at"])
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_trip_coordinates_geom ON trip_coordinates USING GIST (geom)",
    )


def downgrade() -> None:
    op.drop_index("ix_trip_coordinates_geom", table_name="trip_coordinates")
    op.drop_index("ix_trip_coordinates_trip_time", table_name="trip_coordinates")
    op.drop_index("ix_trip_coordinates_tenant_time", table_name="trip_coordinates")
    op.drop_table("trip_coordinates")
