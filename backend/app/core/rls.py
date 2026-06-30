"""Postgres Row-Level Security bootstrap SQL."""

RLS_STATEMENTS: tuple[str, ...] = (
    "CREATE EXTENSION IF NOT EXISTS postgis",
    "CREATE EXTENSION IF NOT EXISTS pgcrypto",
    """
    ALTER TABLE IF EXISTS bookings ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS bookings_tenant_isolation ON bookings;
    CREATE POLICY bookings_tenant_isolation ON bookings
      USING (tenant_id::text = current_setting('app.current_tenant', true));
    """,
    """
    ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS users_tenant_isolation ON users;
    CREATE POLICY users_tenant_isolation ON users
      USING (tenant_id::text = current_setting('app.current_tenant', true));
    """,
    """
    ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS audit_logs_tenant_isolation ON audit_logs;
    CREATE POLICY audit_logs_tenant_isolation ON audit_logs
      USING (tenant_id::text = current_setting('app.current_tenant', true));
    """,
    """
    ALTER TABLE IF EXISTS stops ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS stops_tenant_isolation ON stops;
    CREATE POLICY stops_tenant_isolation ON stops
      USING (tenant_id::text = current_setting('app.current_tenant', true));
    """,
    """
    ALTER TABLE IF EXISTS aade_submissions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS aade_submissions_tenant_isolation ON aade_submissions;
    CREATE POLICY aade_submissions_tenant_isolation ON aade_submissions
      USING (tenant_id::text = current_setting('app.current_tenant', true));
    """,
)


async def apply_rls_policies(connection) -> None:
    from sqlalchemy import text

    for stmt in RLS_STATEMENTS:
        await connection.execute(text(stmt))
