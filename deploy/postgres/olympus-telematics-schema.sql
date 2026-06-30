-- Project OLYMPUS — Telematics Safety & ETA Intelligence
-- Requires: postgis (GIST spatial index on corridors)

CREATE EXTENSION IF NOT EXISTS postgis;

-- Planned route as LineString + configurable corridor buffer (50–100m recommended)
CREATE TABLE IF NOT EXISTS geofence_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    trip_id INT NOT NULL,
    name TEXT NOT NULL DEFAULT 'main_corridor',
    route_geom GEOMETRY(LINESTRING, 4326) NOT NULL,
    buffer_m INT NOT NULL DEFAULT 75 CHECK (buffer_m BETWEEN 30 AND 200),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, trip_id, name)
);

CREATE INDEX IF NOT EXISTS idx_geofence_zones_geom
    ON geofence_zones USING GIST (route_geom);

-- Buffered corridor for fast ST_DWithin checks (materialized optional)
CREATE TABLE IF NOT EXISTS geofence_corridor_cache (
    zone_id UUID PRIMARY KEY REFERENCES geofence_zones(id) ON DELETE CASCADE,
    corridor_geom GEOMETRY(POLYGON, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_geofence_corridor_geom
    ON geofence_corridor_cache USING GIST (corridor_geom);

-- Raw + derived telemetry per point (partition by month in production)
CREATE TABLE IF NOT EXISTS trip_telemetry (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    vehicle_id UUID NOT NULL,
    trip_id INT,
    driver_id UUID,
    recorded_at TIMESTAMPTZ NOT NULL,
    geom GEOMETRY(POINT, 4326) NOT NULL,
    speed_kmh DOUBLE PRECISION NOT NULL DEFAULT 0,
    heading_deg DOUBLE PRECISION,
    engine_on BOOLEAN NOT NULL DEFAULT false,
    fuel_level_pct DOUBLE PRECISION,
    accel_x DOUBLE PRECISION,
    accel_y DOUBLE PRECISION,
    accel_z DOUBLE PRECISION,
    tracker_event_id INT,
    raw_payload JSONB,
    on_corridor BOOLEAN,
    distance_to_route_m DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_trip_telemetry_vehicle_time
    ON trip_telemetry (vehicle_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_telemetry_geom
    ON trip_telemetry USING GIST (geom);

-- G-force / harsh driving events (prefer tracker_event_id over raw accel)
CREATE TABLE IF NOT EXISTS driving_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    vehicle_id UUID NOT NULL,
    driver_id UUID,
    trip_id INT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type TEXT NOT NULL,
    tracker_event_id INT,
    peak_g DOUBLE PRECISION,
    accel_x DOUBLE PRECISION,
    accel_y DOUBLE PRECISION,
    accel_z DOUBLE PRECISION,
    speed_kmh DOUBLE PRECISION,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    score_delta INT NOT NULL DEFAULT 0,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_driving_events_driver_time
    ON driving_events (driver_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_driving_events_trip
    ON driving_events (trip_id, recorded_at DESC);

-- Rolling driver safety profile
CREATE TABLE IF NOT EXISTS driver_safety_profiles (
    driver_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    safety_score INT NOT NULL DEFAULT 100 CHECK (safety_score BETWEEN 0 AND 100),
    events_last_30d INT NOT NULL DEFAULT 0,
    distance_km_30d DOUBLE PRECISION NOT NULL DEFAULT 0,
    events_per_100km DOUBLE PRECISION NOT NULL DEFAULT 0,
    last_event_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Route deviation alerts (deduped)
CREATE TABLE IF NOT EXISTS route_deviations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    vehicle_id UUID NOT NULL,
    trip_id INT NOT NULL,
    zone_id UUID REFERENCES geofence_zones(id),
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    distance_outside_m DOUBLE PRECISION NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    alert_sent BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_route_deviations_trip
    ON route_deviations (trip_id, detected_at DESC);

-- ETA snapshots (traffic-aware, refreshed every 5–10 min)
CREATE TABLE IF NOT EXISTS trip_eta_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    trip_id INT NOT NULL,
    vehicle_id UUID,
    next_stop_id INT,
    next_stop_name TEXT,
    eta_seconds INT NOT NULL,
    distance_m INT,
    duration_in_traffic_seconds INT,
    traffic_level TEXT NOT NULL DEFAULT 'moderate',
    traffic_label TEXT,
    provider TEXT NOT NULL DEFAULT 'google_distance_matrix',
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_eta_trip_time
    ON trip_eta_snapshots (trip_id, computed_at DESC);

-- Extend telemetry_alerts types used by admin dashboard
-- alert_type: ROUTE_DEVIATION | HARSH_BRAKING | HARSH_ACCEL | HARSH_CORNER | IDLE

-- PostGIS: point inside buffered corridor (run per GPS fix)
-- SELECT EXISTS (
--   SELECT 1 FROM geofence_corridor_cache c
--   JOIN geofence_zones z ON z.id = c.zone_id
--   WHERE z.tenant_id = :tenant_id AND z.trip_id = :trip_id AND z.is_active
--     AND ST_DWithin(
--       c.corridor_geom::geography,
--       ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
--       0
--     )
-- );

-- Build / refresh corridor polygon from line + buffer (meters, geography)
-- INSERT INTO geofence_corridor_cache (zone_id, corridor_geom)
-- SELECT id,
--   ST_Buffer(route_geom::geography, buffer_m)::geometry
-- FROM geofence_zones WHERE id = :zone_id
-- ON CONFLICT (zone_id) DO UPDATE SET corridor_geom = EXCLUDED.corridor_geom;
