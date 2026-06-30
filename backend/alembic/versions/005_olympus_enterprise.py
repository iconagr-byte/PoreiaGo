"""Project OLYMPUS enterprise extensions — tenant isolation, audit hardening, provisioning jobs.

Revision ID: 005_olympus_enterprise
Revises: 004_audit_logs_created_at
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "005_olympus_enterprise"
down_revision: Union[str, None] = "004_audit_logs_created_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    has_pg_enum = conn.execute(
        sa.text("SELECT 1 FROM pg_type WHERE typname = 'audit_action'"),
    ).scalar()
    if has_pg_enum:
        op.execute("ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'impersonation_start'")
    # native_enum=False in 001 uses VARCHAR — impersonation_start needs no ALTER TYPE

    op.add_column(
        "tenants",
        sa.Column(
            "isolation_strategy",
            sa.String(32),
            nullable=False,
            server_default="shared_rls",
        ),
    )
    op.add_column(
        "tenants",
        sa.Column("theme_config", postgresql.JSONB, nullable=True),
    )
    op.add_column(
        "tenants",
        sa.Column("admin_ip_whitelist", postgresql.JSONB, nullable=True),
    )
    op.add_column(
        "tenants",
        sa.Column("suspended_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "tenants",
        sa.Column("suspended_reason", sa.Text, nullable=True),
    )

    op.create_table(
        "tenant_provisioning_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("stripe_checkout_session_id", sa.String(128), nullable=True, index=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("isolation_strategy", sa.String(32), nullable=False),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("payload", postgresql.JSONB, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.execute("""
        CREATE OR REPLACE FUNCTION audit_logs_deny_mutation()
        RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'audit_logs is append-only';
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs;
        CREATE TRIGGER audit_logs_no_update
        BEFORE UPDATE OR DELETE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION audit_logs_deny_mutation();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs")
    op.execute("DROP FUNCTION IF EXISTS audit_logs_deny_mutation()")
    op.drop_table("tenant_provisioning_jobs")
    op.drop_column("tenants", "suspended_reason")
    op.drop_column("tenants", "suspended_at")
    op.drop_column("tenants", "admin_ip_whitelist")
    op.drop_column("tenants", "theme_config")
    op.drop_column("tenants", "isolation_strategy")
