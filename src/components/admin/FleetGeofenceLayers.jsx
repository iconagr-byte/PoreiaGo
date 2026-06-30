import { Circle, CircleMarker, Polyline, Popup } from 'react-leaflet';
import { ALERT_MAP_STYLES } from '../../lib/admin/fleetMapAlerts.js';

/** Corridor, stop geofences & alert markers — Leaflet. */
export default function FleetGeofenceLayers({ layers, mapAlerts = [], visible = true }) {
  if (!visible) return null;

  const corridors = layers?.corridors || [];
  const stops = layers?.stops || [];

  return (
    <>
      {corridors.map((corridor) => {
        const positions = (corridor.points || []).map((p) => [p.lat, p.lng]);
        if (positions.length < 2) return null;
        return (
          <Polyline
            key={`corridor-${corridor.trip_id}`}
            positions={positions}
            pathOptions={{
              color: '#16a34a',
              weight: 4,
              opacity: 0.75,
              dashArray: '10 8',
            }}
          />
        );
      })}

      {stops.map((stop) => (
        <Circle
          key={`stop-${stop.trip_id}-${stop.stop_id}`}
          center={[stop.lat, stop.lng]}
          radius={stop.radius_m || layers?.geofence_radius_m || 50}
          pathOptions={{
            color: '#0ea5e9',
            fillColor: '#38bdf8',
            fillOpacity: 0.12,
            weight: 2,
          }}
        >
          <Popup>
            <strong>{stop.name}</strong>
            <br />
            Στάση · geofence {stop.radius_m}m
            <br />
            Δρομολόγιο #{stop.trip_id}
          </Popup>
        </Circle>
      ))}

      {mapAlerts.map((alert) => {
        const style = ALERT_MAP_STYLES[alert.alert_type] || { color: '#dc2626', label: alert.alert_type };
        return (
          <CircleMarker
            key={alert.id || `${alert.alert_type}-${alert.lat}-${alert.lng}`}
            center={[alert.lat, alert.lng]}
            radius={10}
            pathOptions={{
              color: style.color,
              fillColor: style.color,
              fillOpacity: 0.85,
              weight: 3,
            }}
          >
            <Popup>
              <strong>{style.label}</strong>
              <br />
              {alert.message}
              {alert.metadata?.distance_outside_m != null ? (
                <>
                  <br />
                  +{Math.round(alert.metadata.distance_outside_m)}m εκτός διαδρόμου
                </>
              ) : null}
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
