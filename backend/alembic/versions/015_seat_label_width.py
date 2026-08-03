"""Alembic: widen bookings.seat_label for multi-seat labels."""

from alembic import op
import sqlalchemy as sa

revision = "015_seat_label_width"
down_revision = "014_enterprise_foundation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "bookings",
        "seat_label",
        existing_type=sa.String(length=16),
        type_=sa.String(length=128),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "bookings",
        "seat_label",
        existing_type=sa.String(length=128),
        type_=sa.String(length=16),
        existing_nullable=True,
    )
