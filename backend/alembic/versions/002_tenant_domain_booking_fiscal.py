"""Tenant custom domain + booking passenger VAT / fiscal mark.

Revision ID: 002_tenant_domain_booking_fiscal
Revises: 001_saas_initial
Create Date: 2026-06-02
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002_tenant_domain_booking_fiscal"
down_revision: Union[str, None] = "001_saas_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("custom_domain", sa.String(255), nullable=True))
    op.create_unique_constraint("uq_tenants_custom_domain", "tenants", ["custom_domain"])

    op.add_column("bookings", sa.Column("passenger_vat_id", sa.String(32), nullable=True))
    op.add_column("bookings", sa.Column("fiscal_mark", sa.String(64), nullable=True))


def downgrade() -> None:
    op.drop_column("bookings", "fiscal_mark")
    op.drop_column("bookings", "passenger_vat_id")
    op.drop_constraint("uq_tenants_custom_domain", "tenants", type_="unique")
    op.drop_column("tenants", "custom_domain")
