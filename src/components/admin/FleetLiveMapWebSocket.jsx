import { useEffect, useMemo, useState } from 'react';
import { useFleetTelemetryEgress } from '../../context/FleetTelemetryContext.jsx';
import { isMapboxEnabled } from '../../lib/maps/mapboxConfig.js';
import { fetchHeatmap, fetchGeofenceMapLayers } from '../../services/telemetryApi.js';
import { useTelemetryAlerts } from '../../hooks/useTelemetryAlerts.js';
import { mapSosAlertsWithCoords, mapTelemetryAlertsWithCoords } from '../../lib/admin/fleetMapAlerts.js';
import FleetLiveMapLeaflet from './FleetLiveMapLeaflet.jsx';
import FleetLiveMapMapbox from './FleetLiveMapMapbox.jsx';
import AdminFleetPushPanel from './AdminFleetPushPanel.jsx';
import FleetEtaPanel from './FleetEtaPanel.jsx';

/** Ζωντανός χάρτης στόλου — Mapbox αν υπάρχει token, αλλιώς Leaflet. */
export default function FleetLiveMapWebSocket() {
  const { connected, vehicles, tenantId, transport } = useFleetTelemetryEgress();
  const mapbox = isMapboxEnabled();
  const [showHeat, setShowHeat] = useState(false);
  const [heatDays, setHeatDays] = useState(7);
  const [slowOnly, setSlowOnly] = useState(false);
  const [heatmap, setHeatmap] = useState([]);
  const [showGeofence, setShowGeofence] = useState(true);
  const [showSosPins, setShowSosPins] = useState(true);
  const [geofenceLayers, setGeofenceLayers] = useState(null);

  const { alerts, wsConnected: alertsWs } = useTelemetryAlerts({ tenantId, limit: 80, enabled: true });
  const sosAlerts = useMemo(() => mapSosAlertsWithCoords(alerts), [alerts]);
  const mapAlerts = useMemo(() => mapTelemetryAlertsWithCoords(alerts), [alerts]);
  const focusSosAlert = sosAlerts[0] ?? null;

  const activeTripIds = useMemo(
    () =>
      [...new Set(vehicles.map((v) => v.trip_id).filter((id) => id != null))].map((id) => Number(id)),
    [vehicles],
  );

  useEffect(() => {
    if (!showGeofence) {
      setGeofenceLayers(null);
      return undefined;
    }
    const load = () => {
      fetchGeofenceMapLayers({ tripIds: activeTripIds.length ? activeTripIds : undefined })
        .then(setGeofenceLayers)
        .catch(() => setGeofenceLayers({ corridors: [], stops: [] }));
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [showGeofence, activeTripIds.join(',')]);

  useEffect(() => {
    if (!showHeat) {
      setHeatmap([]);
      return undefined;
    }
    const load = () => {
      fetchHeatmap({ days: heatDays, slowOnly }).then(setHeatmap).catch(() => setHeatmap([]));
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [showHeat, heatDays, slowOnly]);

  const center = useMemo(() => {
    if (vehicles.length) return [vehicles[0].lat, vehicles[0].lng];
    return [38.5, 23.0];
  }, [vehicles]);

  const feedLabel =
    transport === 'poll' ? 'HTTP poll' : transport === 'ws' ? 'WebSocket' : 'σύνδεση…';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-headline-md text-2xl font-bold tracking-tight text-slate-900">
            Ζωντανός Χάρτης
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {vehicles.length} ενεργά οχήματα · {feedLabel}
            {connected ? ' ενεργό' : ''}
            {' · '}
            {mapbox ? 'Mapbox' : 'Leaflet'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tenantId ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[10px] text-slate-500">
              {tenantId.slice(0, 8)}…
            </span>
          ) : null}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
              connected
                ? vehicles.length
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-900'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                connected && vehicles.length ? 'bg-emerald-500 animate-pulse' : 'bg-current opacity-40'
              }`}
              aria-hidden
            />
            {connected ? (transport === 'poll' ? 'LIVE · poll' : 'LIVE') : 'Σύνδεση…'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <label className="flex cursor-pointer items-center gap-2 font-semibold text-slate-700">
          <input
            type="checkbox"
            className="rounded border-slate-300"
            checked={showHeat}
            onChange={(e) => setShowHeat(e.target.checked)}
          />
          Heatmap
        </label>
        {showHeat ? (
          <>
            <label className="flex items-center gap-2 text-slate-600">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Περίοδος</span>
              <select
                value={heatDays}
                onChange={(e) => setHeatDays(Number(e.target.value))}
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
              >
                <option value={7}>7 ημέρες</option>
                <option value={30}>30 ημέρες</option>
                <option value={90}>90 ημέρες</option>
              </select>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-slate-600">
              <input
                type="checkbox"
                className="rounded border-slate-300"
                checked={slowOnly}
                onChange={(e) => setSlowOnly(e.target.checked)}
              />
              Μόνο στάσεις (&lt;8 km/h)
            </label>
          </>
        ) : null}
        <label className="flex cursor-pointer items-center gap-2 font-semibold text-slate-700">
          <input
            type="checkbox"
            className="rounded border-slate-300"
            checked={showSosPins}
            onChange={(e) => setShowSosPins(e.target.checked)}
          />
          <span className="text-rose-700">SOS</span>
          {showSosPins && sosAlerts.length ? (
            <span className="text-[10px] font-bold text-rose-600">{sosAlerts.length}</span>
          ) : null}
        </label>
        <label className="flex cursor-pointer items-center gap-2 font-semibold text-slate-700">
          <input
            type="checkbox"
            className="rounded border-slate-300"
            checked={showGeofence}
            onChange={(e) => setShowGeofence(e.target.checked)}
          />
          Geofence
          {showGeofence && mapAlerts.length ? (
            <span className="text-[10px] font-bold text-rose-600">
              {mapAlerts.length}
              {alertsWs ? ' · live' : ''}
            </span>
          ) : null}
        </label>
      </div>

      <AdminFleetPushPanel />

      {!vehicles.length && connected ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="material-symbols-outlined text-slate-400">share_location</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800">Δεν υπάρχουν ενεργοί οδηγοί στον χάρτη</p>
            <p className="text-[12px] text-slate-500">
              Ζητήστε από τον οδηγό να πατήσει «Έναρξη βάρδιας» στην εφαρμογή και να μείνει online.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative h-[min(72vh,640px)] overflow-hidden rounded-[24px] border border-slate-200/90 shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
          {mapbox ? (
            <FleetLiveMapMapbox
              vehicles={vehicles}
              heatmap={heatmap}
              showHeat={showHeat}
              geofenceLayers={geofenceLayers}
              mapAlerts={mapAlerts}
              sosAlerts={sosAlerts}
              showGeofence={showGeofence}
              showSosPins={showSosPins}
              focusSosAlert={showSosPins ? focusSosAlert : null}
            />
          ) : (
            <FleetLiveMapLeaflet
              vehicles={vehicles}
              center={center}
              heatmap={heatmap}
              showHeat={showHeat}
              geofenceLayers={geofenceLayers}
              mapAlerts={mapAlerts}
              sosAlerts={sosAlerts}
              showGeofence={showGeofence}
              showSosPins={showSosPins}
              focusSosAlert={showSosPins ? focusSosAlert : null}
            />
          )}
          {!mapbox ? (
            <p className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium text-slate-500 shadow-sm backdrop-blur">
              Leaflet · ορίστε VITE_MAPBOX_TOKEN για Mapbox
            </p>
          ) : null}
        </div>
        <FleetEtaPanel vehicles={vehicles} connected={connected} transport={transport} />
      </div>
    </div>
  );
}
