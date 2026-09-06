"""rental vehicle description + photo_urls gallery

Revision ID: 013_rental_vehicle_media
Revises: 012_rental_pricing_surcharges
Create Date: 2026-07-26
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "013_rental_vehicle_media"
down_revision = "012_rental_pricing"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "rental_vehicles",
        sa.Column("description", sa.Text(), nullable=True),
    )
    op.add_column(
        "rental_vehicles",
        sa.Column(
            "photo_urls",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("rental_vehicles", "photo_urls")
    op.drop_column("rental_vehicles", "description")
