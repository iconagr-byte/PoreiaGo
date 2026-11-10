import { useState } from 'react';
import { Marker } from 'react-map-gl/mapbox';
import { ALERT_MAP_STYLES } from '../../lib/admin/fleetMapAlerts.js';

/** Prominent pulsing SOS / incident markers — Mapbox GL. */
export default function FleetSosPinsMapbox({ alerts = [], visible = true, onClearSos = null }) {
  const [openId, setOpenId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  if (!visible || !alerts.length) return null;

  return alerts.map((alert) => {
    const style = ALERT_MAP_STYLES[alert.alert_type] || ALERT_MAP_STYLES.SOS;
    const meta = alert.metadata || {};
    const id = alert.id || `${alert.lat}-${alert.lng}`;
    const open = openId === id;
    return (
      <Marker
        key={`sos-${id}`}
        longitude={alert.lng}
        latitude={alert.lat}
        anchor="center"
      >
        <div
          className="fleet-sos-pin fleet-sos-pin--mapbox"
          title={`${style.label}: ${alert.message}`}
          role="button"
          tabIndex={0}
          aria-label={style.label}
          onClick={(e) => {
            e.stopPropagation();
            setOpenId((cur) => (cur === id ? null : id));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpenId((cur) => (cur === id ? null : id));
            }
          }}
        >
          <span className="fleet-sos-pulse" />
          <span className="fleet-sos-pulse fleet-sos-pulse--delay" />
          <span className="fleet-sos-core">🚨</span>
          {open ? (
            <div
              className="fleet-sos-tooltip"
              style={{ opacity: 1, pointerEvents: 'auto', minWidth: 180 }}
              onClick={(e) => e.stopPropagation()}
            >
              <strong>{style.label}</strong>
              <br />
              {alert.message}
              <br />
              <span className="text-[10px] opacity-80">
                Trip #{alert.trip_id ?? meta.trip_id ?? '—'}
              </span>
              {onClearSos && alert.id ? (
                <button
                  type="button"
                  disabled={busyId === alert.id}
                  className="mt-2 w-full rounded-md bg-white px-2 py-1.5 text-[11px] font-bold text-red-700"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setBusyId(alert.id);
                    try {
                      await onClearSos(alert.id);
                      setOpenId(null);
                    } finally {
                      setBusyId(null);
                    }
                  }}
                >
                  {busyId === alert.id ? 'Απενεργοποίηση…' : 'Απενεργοποίηση συναγερμού'}
                </button>
              ) : null}
            </div>
          ) : (
            <span className="fleet-sos-tooltip">
              <strong>{style.label}</strong>
              <br />
              {alert.message}
              <br />
              <span className="text-[10px] opacity-80">
                Trip #{alert.trip_id ?? meta.trip_id ?? '—'}
              </span>
            </span>
          )}
        </div>
      </Marker>
    );
  });
}
