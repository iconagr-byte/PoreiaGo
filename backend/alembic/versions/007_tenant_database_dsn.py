"""Dedicated database DSN for Enterprise tenants.

Revision ID: 007_tenant_database_dsn
Revises: 006_refresh_tokens
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007_tenant_database_dsn"
down_revision: Union[str, None] = "006_refresh_tokens"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column("database_dsn", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tenants", "database_dsn")
