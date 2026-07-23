-- Fleet telemetry & idle control
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS fleet_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    vehicle_code TEXT NOT NULL,
    trip_id INT,
    driver_id UUID,
    UNIQUE (tenant_id, vehicle_code)
);

CREATE TABLE IF NOT EXISTS trip_stops (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    trip_id INT NOT NULL,
    sequence_no INT NOT NULL,
    name TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    geofence_radius_m INT NOT NULL DEFAULT 50,
    arrived_at TIMESTAMPTZ,
    UNIQUE (tenant_id, trip_id, sequence_no)
);

CREATE TABLE IF NOT EXISTS telemetry_points (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    vehicle_id UUID NOT NULL REFERENCES fleet_vehicles(id),
    trip_id INT,
    recorded_at TIMESTAMPTZ NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    speed_kmh DOUBLE PRECISION NOT NULL DEFAULT 0,
    engine_on BOOLEAN NOT NULL DEFAULT false,
    fuel_level_pct DOUBLE PRECISION,
    raw_payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_telemetry_vehicle_time ON telemetry_points (vehicle_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_tenant_time ON telemetry_points (tenant_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS vehicle_positions_latest (
    vehicle_id UUID PRIMARY KEY REFERENCES fleet_vehicles(id),
    tenant_id UUID NOT NULL,
    trip_id INT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    speed_kmh DOUBLE PRECISION NOT NULL,
    engine_on BOOLEAN NOT NULL,
    fuel_level_pct DOUBLE PRECISION,
    idle_seconds_today INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS idle_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    vehicle_id UUID NOT NULL,
    trip_id INT,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_seconds INT,
    fuel_wasted_liters NUMERIC(10,3),
    idle_cost_eur NUMERIC(10,2),
    alert_sent BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS telemetry_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    vehicle_id UUID NOT NULL,
    alert_type TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stop_arrival_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    trip_id INT NOT NULL,
    stop_id INT NOT NULL REFERENCES trip_stops(id),
    vehicle_id UUID NOT NULL,
    arrived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Historical GPS trail (Fleet KPIs / route playback) — PostGIS points
CREATE TABLE IF NOT EXISTS trip_coordinates (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    trip_id INT,
    driver_id UUID,
    vehicle_id UUID,
    recorded_at TIMESTAMPTZ NOT NULL,
    speed_kmh DOUBLE PRECISION NOT NULL DEFAULT 0,
    heading_deg DOUBLE PRECISION,
    geom geometry(POINT, 4326) NOT NULL,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_trip_coordinates_tenant_time ON trip_coordinates (tenant_id, recorded_at);
CREATE INDEX IF NOT EXISTS ix_trip_coordinates_trip_time ON trip_coordinates (trip_id, recorded_at);
CREATE INDEX IF NOT EXISTS ix_trip_coordinates_geom ON trip_coordinates USING GIST (geom);
