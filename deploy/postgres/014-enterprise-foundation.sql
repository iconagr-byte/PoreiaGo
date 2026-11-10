# Append to fleet-rental-schema.sql when applying enterprise foundation manually.
# Prefer Alembic revision 014_enterprise_foundation in production.

ALTER TABLE rental_vehicles ADD COLUMN IF NOT EXISTS year INTEGER;

CREATE OR REPLACE VIEW rental_contracts AS
SELECT
  id,
  tenant_id,
  vehicle_id,
  client_id,
  start_time AS start_datetime,
  end_time AS end_datetime,
  pickup_location,
  dropoff_location,
  total_cost AS total_price,
  rental_status AS contract_status,
  client_name,
  client_email,
  client_phone,
  driver_mode,
  assigned_driver_id,
  notes,
  created_at,
  updated_at
FROM rental_bookings;

CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID,
  client_email VARCHAR(200),
  display_name VARCHAR(160),
  lifetime_miles NUMERIC(14, 2) NOT NULL DEFAULT 0,
  redeemable_miles NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tier VARCHAR(32) NOT NULL DEFAULT 'STANDARD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_loyalty_accounts_tenant_email UNIQUE (tenant_id, client_email)
);

CREATE TABLE IF NOT EXISTS miles_transactions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  loyalty_account_id UUID NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  tx_type VARCHAR(32) NOT NULL,
  miles NUMERIC(14, 2) NOT NULL,
  balance_after NUMERIC(14, 2) NOT NULL DEFAULT 0,
  source_kind VARCHAR(32),
  source_id UUID,
  distance_km NUMERIC(12, 3),
  multiplier NUMERIC(8, 4) NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_miles_transactions_nonzero CHECK (miles <> 0)
);
