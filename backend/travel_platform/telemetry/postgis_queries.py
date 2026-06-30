"""
PostGIS query templates — corridor geofence (R-Tree via GIST).

Use geography casts so buffer_m is in true meters on the spheroid.
"""

CORRIDOR_ON_ROUTE_SQL = """
SELECT EXISTS (
    SELECT 1
    FROM geofence_corridor_cache c
    INNER JOIN geofence_zones z ON z.id = c.zone_id
    WHERE z.tenant_id = :tenant_id
      AND z.trip_id = :trip_id
      AND z.is_active = true
      AND ST_DWithin(
            c.corridor_geom::geography,
            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
            0
          )
) AS on_corridor
"""

DISTANCE_TO_ROUTE_SQL = """
SELECT MIN(
    ST_Distance(
        ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
        z.route_geom::geography
    )
) AS distance_m
FROM geofence_zones z
WHERE z.tenant_id = :tenant_id
  AND z.trip_id = :trip_id
  AND z.is_active = true
"""

REFRESH_CORRIDOR_CACHE_SQL = """
INSERT INTO geofence_corridor_cache (zone_id, corridor_geom)
SELECT z.id, ST_Buffer(z.route_geom::geography, z.buffer_m)::geometry
FROM geofence_zones z
WHERE z.id = :zone_id
ON CONFLICT (zone_id) DO UPDATE
SET corridor_geom = EXCLUDED.corridor_geom
"""
