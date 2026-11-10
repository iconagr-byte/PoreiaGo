"""Fleet rental — one-way surcharge + with-driver daily rate."""

from alembic import op
import sqlalchemy as sa

revision = "012_rental_pricing"
down_revision = "011_fleet_rental"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "rental_vehicles",
        sa.Column("one_way_surcharge_eur", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "rental_vehicles",
        sa.Column("with_driver_daily_eur", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("rental_vehicles", "with_driver_daily_eur")
    op.drop_column("rental_vehicles", "one_way_surcharge_eur")
