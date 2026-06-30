import { Marker } from 'react-map-gl/mapbox';
import { ALERT_MAP_STYLES } from '../../lib/admin/fleetMapAlerts.js';

/** Prominent pulsing SOS / incident markers — Mapbox GL. */
export default function FleetSosPinsMapbox({ alerts = [], visible = true }) {
  if (!visible || !alerts.length) return null;

  return alerts.map((alert) => {
    const style = ALERT_MAP_STYLES[alert.alert_type] || ALERT_MAP_STYLES.SOS;
    const meta = alert.metadata || {};
    return (
      <Marker
        key={`sos-${alert.id || `${alert.lat}-${alert.lng}`}`}
        longitude={alert.lng}
        latitude={alert.lat}
        anchor="center"
      >
        <div
          className="fleet-sos-pin fleet-sos-pin--mapbox"
          title={`${style.label}: ${alert.message}`}
          role="img"
          aria-label={style.label}
        >
          <span className="fleet-sos-pulse" />
          <span className="fleet-sos-pulse fleet-sos-pulse--delay" />
          <span className="fleet-sos-core">🚨</span>
          <span className="fleet-sos-tooltip">
            <strong>{style.label}</strong>
            <br />
            {alert.message}
            <br />
            <span className="text-[10px] opacity-80">
              Trip #{alert.trip_id ?? meta.trip_id ?? '—'}
            </span>
          </span>
        </div>
      </Marker>
    );
  });
}
