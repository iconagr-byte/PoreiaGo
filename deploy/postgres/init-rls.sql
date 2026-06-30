-- Run once on fresh DB. Application must SET LOCAL app.current_tenant per request.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'starter',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
    id TEXT NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    trip_id INTEGER NOT NULL,
    ticket_ref UUID NOT NULL,
    customer_name TEXT NOT NULL,
    seat_number TEXT NOT NULL,
    payment_status TEXT NOT NULL,
    check_in_status TEXT NOT NULL DEFAULT 'NONE',
    special_requirements JSONB DEFAULT '{}',
    aade_mark TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_bookings_trip ON bookings (tenant_id, trip_id, check_in_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_ticket_ref ON bookings (tenant_id, ticket_ref);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY bookings_tenant_isolation ON bookings
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- Force RLS for table owner too
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;
