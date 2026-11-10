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

-- ---------------------------------------------------------------------------
-- Hybrid travel (flights + unified timeline)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flights (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    trip_id INT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    flight_number VARCHAR(32) NOT NULL,
    airline VARCHAR(120) NOT NULL DEFAULT '',
    departure_airport VARCHAR(8) NOT NULL,
    arrival_airport VARCHAR(8) NOT NULL,
    departure_time TIMESTAMPTZ NOT NULL,
    arrival_time TIMESTAMPTZ NOT NULL,
    pnr_code VARCHAR(32),
    seats_allocated INT NOT NULL DEFAULT 0,
    cost_per_seat NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    status VARCHAR(32) NOT NULL DEFAULT 'scheduled',
    delay_minutes INT NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_flights_tenant_trip ON flights (tenant_id, trip_id);
CREATE INDEX IF NOT EXISTS ix_flights_departure ON flights (departure_time);
CREATE INDEX IF NOT EXISTS ix_flights_pnr ON flights (pnr_code);

CREATE TABLE IF NOT EXISTS trip_segments (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    trip_id INT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    sequence INT NOT NULL DEFAULT 0,
    segment_type VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL DEFAULT '',
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    flight_id UUID REFERENCES flights(id) ON DELETE SET NULL,
    vehicle_ref VARCHAR(64),
    origin_label VARCHAR(255),
    destination_label VARCHAR(255),
    ground_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, trip_id, sequence)
);
CREATE INDEX IF NOT EXISTS ix_trip_segments_tenant_trip ON trip_segments (tenant_id, trip_id);

CREATE TABLE IF NOT EXISTS passenger_flight_seats (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    trip_id INT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    flight_id UUID REFERENCES flights(id) ON DELETE CASCADE,
    booking_id VARCHAR(64),
    passenger_name VARCHAR(255) NOT NULL,
    ground_seat VARCHAR(32),
    flight_seat VARCHAR(16),
    ticket_code VARCHAR(64),
    pnr_code VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_passenger_flight_seats_trip ON passenger_flight_seats (tenant_id, trip_id);

CREATE TABLE IF NOT EXISTS luggage_checkins (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    trip_id INT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    booking_id VARCHAR(64),
    passenger_name VARCHAR(255) NOT NULL,
    checkin_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    luggage_count INT NOT NULL DEFAULT 0,
    luggage_notes TEXT,
    checked_by VARCHAR(120),
    checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_luggage_checkins_trip ON luggage_checkins (tenant_id, trip_id);

CREATE TABLE IF NOT EXISTS flight_status_events (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    flight_id UUID NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
    provider VARCHAR(64) NOT NULL DEFAULT 'stub',
    status VARCHAR(32) NOT NULL,
    delay_minutes INT NOT NULL DEFAULT 0,
    suggested_pickup_adjustment_minutes INT NOT NULL DEFAULT 0,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_flight_status_events_flight ON flight_status_events (flight_id, created_at);

CREATE TABLE IF NOT EXISTS hybrid_trip_meta (
    tenant_id UUID NOT NULL,
    trip_id INT NOT NULL,
    rooming_list JSONB NOT NULL DEFAULT '[]'::jsonb,
    passenger_extras JSONB NOT NULL DEFAULT '[]'::jsonb,
    supplier_cost_sheets JSONB NOT NULL DEFAULT '[]'::jsonb,
    crew JSONB NOT NULL DEFAULT '{}'::jsonb,
    airport_buffers JSONB NOT NULL DEFAULT '{}'::jsonb,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    target_margin_pct NUMERIC(6,2) NOT NULL DEFAULT 25,
    connection_threshold_min INT NOT NULL DEFAULT 90,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, trip_id)
);
CREATE INDEX IF NOT EXISTS ix_hybrid_trip_meta_trip ON hybrid_trip_meta (trip_id);

ALTER TABLE flights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_flights ON flights;
CREATE POLICY tenant_isolation_flights ON flights
    USING (tenant_id::text = current_setting('app.current_tenant', true));

ALTER TABLE trip_segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_trip_segments ON trip_segments;
CREATE POLICY tenant_isolation_trip_segments ON trip_segments
    USING (tenant_id::text = current_setting('app.current_tenant', true));

ALTER TABLE passenger_flight_seats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_passenger_flight_seats ON passenger_flight_seats;
CREATE POLICY tenant_isolation_passenger_flight_seats ON passenger_flight_seats
    USING (tenant_id::text = current_setting('app.current_tenant', true));

ALTER TABLE luggage_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_luggage_checkins ON luggage_checkins;
CREATE POLICY tenant_isolation_luggage_checkins ON luggage_checkins
    USING (tenant_id::text = current_setting('app.current_tenant', true));

ALTER TABLE flight_status_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_flight_status_events ON flight_status_events;
CREATE POLICY tenant_isolation_flight_status_events ON flight_status_events
    USING (tenant_id::text = current_setting('app.current_tenant', true));

ALTER TABLE hybrid_trip_meta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_hybrid_trip_meta ON hybrid_trip_meta;
CREATE POLICY tenant_isolation_hybrid_trip_meta ON hybrid_trip_meta
    USING (tenant_id::text = current_setting('app.current_tenant', true));
