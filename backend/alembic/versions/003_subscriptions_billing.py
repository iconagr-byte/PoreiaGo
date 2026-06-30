"""Subscriptions, usage snapshots, Stripe customer on tenants.

Revision ID: 003_subscriptions_billing
Revises: 002_tenant_domain_booking_fiscal
Create Date: 2026-06-09
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003_subscriptions_billing"
down_revision: Union[str, None] = "002_tenant_domain_booking_fiscal"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("stripe_customer_id", sa.String(64), nullable=True))
    op.create_index("ix_tenants_stripe_customer_id", "tenants", ["stripe_customer_id"], unique=True)

    op.create_table(
        "subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("stripe_subscription_id", sa.String(64), nullable=True),
        sa.Column("stripe_price_id", sa.String(64), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "trialing",
                "active",
                "past_due",
                "canceled",
                "unpaid",
                "incomplete",
                name="subscription_status",
                native_enum=False,
            ),
            nullable=False,
            server_default="trialing",
        ),
        sa.Column(
            "plan",
            sa.Enum("starter", "professional", "enterprise", name="tenant_plan", native_enum=False),
            nullable=False,
            server_default="starter",
        ),
        sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("canceled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("base_amount_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("metered_buses", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("metered_trips", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("tenant_id", name="uq_subscriptions_tenant_id"),
        sa.UniqueConstraint("stripe_subscription_id", name="uq_subscriptions_stripe_sub_id"),
    )
    op.create_index("ix_subscriptions_tenant_id", "subscriptions", ["tenant_id"])
    op.create_index("ix_subscriptions_status", "subscriptions", ["status"])

    op.create_table(
        "usage_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("active_buses", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("monthly_trips", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reported_to_stripe_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("stripe_usage_record_ids", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("tenant_id", "period_start", name="uq_usage_snapshots_tenant_period"),
    )
    op.create_index("ix_usage_snapshots_tenant_id", "usage_snapshots", ["tenant_id"])


def downgrade() -> None:
    op.drop_index("ix_usage_snapshots_tenant_id", table_name="usage_snapshots")
    op.drop_table("usage_snapshots")
    op.drop_index("ix_subscriptions_status", table_name="subscriptions")
    op.drop_index("ix_subscriptions_tenant_id", table_name="subscriptions")
    op.drop_table("subscriptions")
    op.drop_index("ix_tenants_stripe_customer_id", table_name="tenants")
    op.drop_column("tenants", "stripe_customer_id")
    op.execute("DROP TYPE IF EXISTS subscription_status")
