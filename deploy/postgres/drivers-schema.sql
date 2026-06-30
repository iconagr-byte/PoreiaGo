-- Driver Personnel & Logistics Management
-- Run after platform-schema.sql. Requires gen_random_uuid() / uuid-ossp.

-- ---------------------------------------------------------------------------
-- Core driver record
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    personal_info JSONB NOT NULL DEFAULT '{}',
    -- personal_info: { "name", "license_no", "phone", "email" }
    hiring_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'on_leave', 'terminated')),
    -- Compensation config (current; history in driver_pay_rates)
    salary_per_km NUMERIC(10,4),
    salary_per_trip NUMERIC(10,2),
    bonus_structure JSONB DEFAULT '{}',
    -- bonus_structure: { "rating_threshold": 4.5, "bonus_pct": 5 }
    current_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_drivers_tenant_status ON drivers (tenant_id, status);

-- Cached aggregates — refreshed by worker, not computed on every GET /stats
CREATE TABLE IF NOT EXISTS driver_stats_cache (
    driver_id UUID PRIMARY KEY REFERENCES drivers(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    total_kms_driven NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_hours_driven NUMERIC(10,2) NOT NULL DEFAULT 0,
    assignments_count INT NOT NULL DEFAULT 0,
    avg_passenger_rating NUMERIC(4,2),
    trips_completed INT NOT NULL DEFAULT 0,
    feedback_count INT NOT NULL DEFAULT 0,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Immutable financial ledger (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS driver_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    driver_id UUID NOT NULL REFERENCES drivers(id),
    trip_id INT,
    amount NUMERIC(12,2) NOT NULL,
    earning_type TEXT NOT NULL DEFAULT 'trip_commission',
    description TEXT,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS driver_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    driver_id UUID NOT NULL REFERENCES drivers(id),
    trip_id INT,
    amount NUMERIC(12,2) NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('fuel', 'tolls', 'maintenance', 'other')),
    description TEXT,
    receipt_ref TEXT,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS driver_balance_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    driver_id UUID NOT NULL REFERENCES drivers(id),
    entry_type TEXT NOT NULL CHECK (entry_type IN ('earning', 'expense', 'advance', 'deduction', 'payout')),
    amount NUMERIC(12,2) NOT NULL,
    balance_after NUMERIC(12,2) NOT NULL,
    reference_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Versioned pay rates — never UPDATE; insert new row and close previous
CREATE TABLE IF NOT EXISTS driver_pay_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    driver_id UUID NOT NULL REFERENCES drivers(id),
    salary_per_km NUMERIC(10,4),
    salary_per_trip NUMERIC(10,2),
    bonus_structure JSONB DEFAULT '{}',
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    superseded_at TIMESTAMPTZ,
    created_by TEXT,
    change_reason TEXT
);

-- ---------------------------------------------------------------------------
-- Trip assignments (availability + kms/hours source)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS driver_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    driver_id UUID NOT NULL REFERENCES drivers(id),
    trip_id INT NOT NULL,
    shift_start TIMESTAMPTZ NOT NULL,
    shift_end TIMESTAMPTZ NOT NULL,
    distance_km NUMERIC(10,2),
    status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignments_driver_window
    ON driver_assignments (driver_id, shift_start, shift_end);

-- ---------------------------------------------------------------------------
-- Document vault (licenses, certificates)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS driver_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    driver_id UUID NOT NULL REFERENCES drivers(id),
    doc_type TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    file_name TEXT,
    expires_at DATE NOT NULL,
    alert_sent_at TIMESTAMPTZ,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_docs_expiry
    ON driver_documents (tenant_id, expires_at)
    WHERE alert_sent_at IS NULL;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_drivers ON drivers;
CREATE POLICY tenant_drivers ON drivers
    USING (tenant_id::text = current_setting('app.current_tenant', true));

ALTER TABLE driver_stats_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_driver_stats ON driver_stats_cache;
CREATE POLICY tenant_driver_stats ON driver_stats_cache
    USING (tenant_id::text = current_setting('app.current_tenant', true));

ALTER TABLE driver_earnings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_driver_earnings ON driver_earnings;
CREATE POLICY tenant_driver_earnings ON driver_earnings
    USING (tenant_id::text = current_setting('app.current_tenant', true));

ALTER TABLE driver_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_driver_expenses ON driver_expenses;
CREATE POLICY tenant_driver_expenses ON driver_expenses
    USING (tenant_id::text = current_setting('app.current_tenant', true));

ALTER TABLE driver_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_driver_assignments ON driver_assignments;
CREATE POLICY tenant_driver_assignments ON driver_assignments
    USING (tenant_id::text = current_setting('app.current_tenant', true));

ALTER TABLE driver_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_driver_documents ON driver_documents;
CREATE POLICY tenant_driver_documents ON driver_documents
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Immutability triggers (PostgreSQL)
CREATE OR REPLACE FUNCTION forbid_driver_financial_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'driver financial records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_driver_earnings_immutable ON driver_earnings;
CREATE TRIGGER trg_driver_earnings_immutable
    BEFORE UPDATE OR DELETE ON driver_earnings
    FOR EACH ROW EXECUTE FUNCTION forbid_driver_financial_mutation();

DROP TRIGGER IF EXISTS trg_driver_expenses_immutable ON driver_expenses;
CREATE TRIGGER trg_driver_expenses_immutable
    BEFORE UPDATE OR DELETE ON driver_expenses
    FOR EACH ROW EXECUTE FUNCTION forbid_driver_financial_mutation();
