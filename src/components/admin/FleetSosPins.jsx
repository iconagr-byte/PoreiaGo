import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { ALERT_MAP_STYLES } from '../../lib/admin/fleetMapAlerts.js';

const sosIcon = L.divIcon({
  className: 'fleet-sos-pin-wrap',
  html: `
    <div class="fleet-sos-pin" role="img" aria-label="SOS">
      <span class="fleet-sos-pulse"></span>
      <span class="fleet-sos-pulse fleet-sos-pulse--delay"></span>
      <span class="fleet-sos-core">🚨</span>
    </div>
  `,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

function formatSosTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('el-GR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  } catch {
    return iso;
  }
}

/** Prominent pulsing SOS / incident markers — Leaflet. */
export default function FleetSosPins({ alerts = [], visible = true }) {
  if (!visible || !alerts.length) return null;

  return alerts.map((alert) => {
    const style = ALERT_MAP_STYLES[alert.alert_type] || ALERT_MAP_STYLES.SOS;
    const meta = alert.metadata || {};
    return (
      <Marker
        key={`sos-${alert.id || `${alert.lat}-${alert.lng}`}`}
        position={[alert.lat, alert.lng]}
        icon={sosIcon}
        zIndexOffset={1000}
      >
        <Popup className="fleet-sos-popup" maxWidth={280}>
          <div className="space-y-1 text-sm">
            <p className="font-black text-red-700 text-base flex items-center gap-1">
              <span>🚨</span> {style.label}
            </p>
            <p className="font-semibold text-gray-900">{alert.message}</p>
            <p className="text-xs text-gray-500">
              Trip #{alert.trip_id ?? meta.trip_id ?? '—'}
              {meta.driver_id ? ` · ${meta.driver_id}` : ''}
            </p>
            <p className="text-xs font-mono text-gray-600">
              {alert.lat.toFixed(5)}, {alert.lng.toFixed(5)}
              {meta.accuracy_m != null ? ` (±${Math.round(meta.accuracy_m)}m)` : ''}
            </p>
            <p className="text-[10px] text-gray-400">{formatSosTime(alert.created_at)}</p>
          </div>
        </Popup>
      </Marker>
    );
  });
}
