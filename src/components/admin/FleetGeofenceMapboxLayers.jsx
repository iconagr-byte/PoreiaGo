import { Layer, Source, Marker } from 'react-map-gl/mapbox';
import { ALERT_MAP_STYLES } from '../../lib/admin/fleetMapAlerts.js';

function corridorsToGeoJson(corridors) {
  return {
    type: 'FeatureCollection',
    features: (corridors || [])
      .filter((c) => (c.points || []).length >= 2)
      .map((corridor) => ({
        type: 'Feature',
        properties: { trip_id: corridor.trip_id, name: corridor.name },
        geometry: {
          type: 'LineString',
          coordinates: corridor.points.map((p) => [p.lng, p.lat]),
        },
      })),
  };
}

/** Corridor, stop geofences & alert markers — Mapbox GL. */
export default function FleetGeofenceMapboxLayers({ layers, mapAlerts = [], visible = true }) {
  if (!visible) return null;

  const corridors = layers?.corridors || [];
  const stops = layers?.stops || [];
  const corridorGeo = corridorsToGeoJson(corridors);

  return (
    <>
      {corridorGeo.features.length ? (
        <Source id="fleet-corridors" type="geojson" data={corridorGeo}>
          <Layer
            id="fleet-corridor-line"
            type="line"
            paint={{
              'line-color': '#16a34a',
              'line-width': 4,
              'line-opacity': 0.8,
              'line-dasharray': [2, 2],
            }}
          />
        </Source>
      ) : null}

      {stops.map((stop) => (
        <Marker key={`stop-${stop.trip_id}-${stop.stop_id}`} longitude={stop.lng} latitude={stop.lat} anchor="center">
          <div
            className="rounded-full border-2 border-sky-500 bg-sky-400/20"
            style={{
              width: `${Math.min(48, Math.max(20, (stop.radius_m || 50) / 4))}px`,
              height: `${Math.min(48, Math.max(20, (stop.radius_m || 50) / 4))}px`,
            }}
            title={stop.name}
          />
        </Marker>
      ))}

      {mapAlerts.map((alert) => {
        const style = ALERT_MAP_STYLES[alert.alert_type] || { color: '#dc2626', label: alert.alert_type };
        return (
          <Marker
            key={alert.id || `${alert.alert_type}-${alert.lat}`}
            longitude={alert.lng}
            latitude={alert.lat}
            anchor="center"
          >
            <div
              className="h-5 w-5 rounded-full border-2 border-white shadow-lg"
              style={{ backgroundColor: style.color }}
              title={alert.message}
            />
          </Marker>
        );
      })}
    </>
  );
}
