"""Partial payments + fiscal invoices per booking.

Revision ID: 007_booking_partial_payments
Revises: 007_tenant_database_dsn
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "007_booking_partial_payments"
down_revision: Union[str, None] = "007_tenant_database_dsn"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "bookings",
        sa.Column("total_price", sa.Numeric(12, 2), nullable=True),
    )
    op.add_column(
        "bookings",
        sa.Column("amount_paid", sa.Numeric(12, 2), server_default="0", nullable=False),
    )
    op.add_column(
        "bookings",
        sa.Column(
            "payment_status",
            sa.String(16),
            server_default="pending",
            nullable=False,
        ),
    )
    op.create_index("ix_bookings_payment_status", "bookings", ["payment_status"])

    op.execute("UPDATE bookings SET total_price = amount_eur WHERE total_price IS NULL")
    op.execute(
        """
        UPDATE bookings
        SET amount_paid = amount_eur
        WHERE status IN ('paid', 'boarded', 'confirmed')
        """
    )
    op.execute(
        """
        UPDATE bookings
        SET payment_status = 'paid'
        WHERE amount_paid >= total_price AND total_price > 0
        """
    )
    op.execute(
        """
        UPDATE bookings
        SET payment_status = 'partial'
        WHERE amount_paid > 0 AND amount_paid < total_price
        """
    )
    op.alter_column("bookings", "total_price", nullable=False)

    op.create_table(
        "fiscal_invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "booking_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("bookings.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "aade_submission_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("aade_submissions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("invoice_kind", sa.String(32), nullable=False),
        sa.Column("status", sa.String(16), server_default="pending", nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(3), server_default="EUR", nullable=False),
        sa.Column("stripe_payment_intent_id", sa.String(128), nullable=True),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("aade_mark", sa.String(64), nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("metadata_json", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("stripe_payment_intent_id", name="uq_fiscal_invoices_stripe_pi"),
        sa.UniqueConstraint("idempotency_key", name="uq_fiscal_invoices_idempotency"),
    )
    op.create_index("ix_fiscal_invoices_tenant_id", "fiscal_invoices", ["tenant_id"])
    op.create_index("ix_fiscal_invoices_booking_id", "fiscal_invoices", ["booking_id"])
    op.create_index("ix_fiscal_invoices_status", "fiscal_invoices", ["status"])


def downgrade() -> None:
    op.drop_table("fiscal_invoices")
    op.drop_index("ix_bookings_payment_status", table_name="bookings")
    op.drop_column("bookings", "payment_status")
    op.drop_column("bookings", "amount_paid")
    op.drop_column("bookings", "total_price")
