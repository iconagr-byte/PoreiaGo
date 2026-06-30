-- Platform SaaS tables + RLS (run after base schema)
-- Requires: CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Bookings extensions (abandoned recovery)
-- ---------------------------------------------------------------------------
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recovery_sent_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS trip_title TEXT;

-- ---------------------------------------------------------------------------
-- Trips (dynamic pricing)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trips (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    total_seats INT NOT NULL DEFAULT 50,
    base_price NUMERIC(10,2) NOT NULL,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    rule_type TEXT NOT NULL,
    threshold_pct NUMERIC(5,2),
    adjustment_pct NUMERIC(5,2),
    active BOOLEAN DEFAULT true
);

-- ---------------------------------------------------------------------------
-- Operations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS master_qr_tokens (
    tenant_id UUID NOT NULL,
    trip_id INT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN DEFAULT false,
    PRIMARY KEY (tenant_id, trip_id)
);

CREATE TABLE IF NOT EXISTS safety_verifications (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    trip_id INT NOT NULL,
    driver_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress',
    items JSONB DEFAULT '{}',
    notes TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- Growth
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_branding (
    tenant_id UUID PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#0040df',
    custom_domain TEXT UNIQUE,
    css_injection_url TEXT,
    css_injection_inline TEXT,
    verified_domain BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    partner_name TEXT NOT NULL,
    target_url TEXT NOT NULL,
    event_types JSONB NOT NULL DEFAULT '[]',
    secret_ref TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Compliance — immutable audit log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    actor_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    financial BOOLEAN DEFAULT false,
    ip_address INET,
    user_agent TEXT,
    prev_hash TEXT DEFAULT '',
    event_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_created ON audit_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_financial ON audit_events (tenant_id, financial) WHERE financial = true;

-- Revoke UPDATE/DELETE on audit (application role)
-- REVOKE UPDATE, DELETE ON audit_events FROM app_user;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_bookings ON bookings;
CREATE POLICY tenant_isolation_bookings ON bookings
    USING (tenant_id::text = current_setting('app.current_tenant', true));

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_trips ON trips;
CREATE POLICY tenant_isolation_trips ON trips
    USING (tenant_id::text = current_setting('app.current_tenant', true));

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_audit ON audit_events;
CREATE POLICY tenant_isolation_audit ON audit_events
    USING (tenant_id::text = current_setting('app.current_tenant', true));
