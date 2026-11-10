-- Fleet Rental Module (mirror of Alembic 011_fleet_rental)
-- Apply when promoting file-store rentals to Postgres.

CREATE TABLE IF NOT EXISTS rental_vehicles (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plate_number VARCHAR(32) NOT NULL,
  category VARCHAR(32) NOT NULL,
  model VARCHAR(120) NOT NULL,
  seating_capacity INTEGER NOT NULL DEFAULT 5,
  current_status VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE',
  current_mileage INTEGER NOT NULL DEFAULT 0,
  daily_rate_eur NUMERIC(10, 2) NOT NULL DEFAULT 0,
  one_way_surcharge_eur NUMERIC(10, 2) NOT NULL DEFAULT 0,
  with_driver_daily_eur NUMERIC(10, 2) NOT NULL DEFAULT 0,
  gps_device_id VARCHAR(64),
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_rental_vehicles_tenant_plate UNIQUE (tenant_id, plate_number)
);

CREATE INDEX IF NOT EXISTS ix_rental_vehicles_tenant ON rental_vehicles (tenant_id);
CREATE INDEX IF NOT EXISTS ix_rental_vehicles_status ON rental_vehicles (tenant_id, current_status);
CREATE INDEX IF NOT EXISTS ix_rental_vehicles_category ON rental_vehicles (tenant_id, category);

CREATE TABLE IF NOT EXISTS rental_bookings (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES rental_vehicles(id) ON DELETE RESTRICT,
  client_id UUID,
  client_name VARCHAR(160) NOT NULL,
  client_email VARCHAR(200),
  client_phone VARCHAR(40),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  pickup_location VARCHAR(240) NOT NULL,
  dropoff_location VARCHAR(240) NOT NULL,
  total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  rental_status VARCHAR(32) NOT NULL DEFAULT 'CONFIRMED',
  driver_mode VARCHAR(32) NOT NULL DEFAULT 'SELF_DRIVE',
  assigned_driver_id VARCHAR(64),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_rental_bookings_time_range CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS ix_rental_bookings_tenant ON rental_bookings (tenant_id);
CREATE INDEX IF NOT EXISTS ix_rental_bookings_vehicle_time ON rental_bookings (vehicle_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS ix_rental_bookings_status ON rental_bookings (tenant_id, rental_status);

CREATE TABLE IF NOT EXISTS vehicle_inspections (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rental_booking_id UUID NOT NULL REFERENCES rental_bookings(id) ON DELETE CASCADE,
  inspection_type VARCHAR(32) NOT NULL,
  fuel_level NUMERIC(5, 2) NOT NULL DEFAULT 100,
  mileage INTEGER NOT NULL DEFAULT 0,
  damage_notes TEXT,
  photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  signature_url TEXT,
  inspector_name VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_vehicle_inspections_tenant ON vehicle_inspections (tenant_id);
CREATE INDEX IF NOT EXISTS ix_vehicle_inspections_booking ON vehicle_inspections (rental_booking_id);

ALTER TABLE rental_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_inspections ENABLE ROW LEVEL SECURITY;

-- Pricing surcharges (safe re-apply on existing offices)
ALTER TABLE rental_vehicles
  ADD COLUMN IF NOT EXISTS one_way_surcharge_eur NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE rental_vehicles
  ADD COLUMN IF NOT EXISTS with_driver_daily_eur NUMERIC(10, 2) NOT NULL DEFAULT 0;
