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
  const [showHeat, setShowHeat] = useState(true);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-headline-md font-bold">Ζωντανός Χάρτης Στόλου</h2>
          <p className="text-sm text-on-surface-variant">
            {vehicles.length} ενεργά οχήματα ·{' '}
            {transport === 'poll'
              ? 'HTTP poll'
              : transport === 'ws'
                ? 'WebSocket'
                : 'σύνδεση…'}{' '}
            {connected ? 'ενεργό' : 'εκτός'}
            {' · '}
            {mapbox ? 'Mapbox GL' : 'Leaflet (χωρίς token)'}
            {showHeat && heatmap.length ? (
              <span className="text-[10px] text-orange-600 ml-2">
                heatmap {heatmap.length} κελιά ({heatDays}ημ.)
              </span>
            ) : null}
            {tenantId ? (
              <span className="text-[10px] text-gray-400 ml-2 font-mono">tenant {tenantId.slice(0, 8)}…</span>
            ) : null}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
            connected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">sensors</span>
          {connected ? (transport === 'poll' ? 'LIVE (poll)' : 'ΖΩΝΤΑΝΑ') : '…'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-black/[0.06] bg-white px-4 py-3 text-sm">
        <label className="flex items-center gap-2 font-bold cursor-pointer">
          <input type="checkbox" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} />
          Heatmap GPS
        </label>
        {showHeat ? (
          <>
            <label className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-gray-400">Περίοδος</span>
              <select
                value={heatDays}
                onChange={(e) => setHeatDays(Number(e.target.value))}
                className="rounded-lg border border-gray-200 px-2 py-1 text-sm"
              >
                <option value={7}>7 ημέρες</option>
                <option value={30}>30 ημέρες</option>
                <option value={90}>90 ημέρες</option>
              </select>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={slowOnly} onChange={(e) => setSlowOnly(e.target.checked)} />
              Μόνο στάσεις (&lt;8 km/h)
            </label>
          </>
        ) : null}
        <label className="flex items-center gap-2 font-bold cursor-pointer">
          <input type="checkbox" checked={showSosPins} onChange={(e) => setShowSosPins(e.target.checked)} />
          <span className="text-red-700">SOS pins</span>
        </label>
        {showSosPins && sosAlerts.length ? (
          <span className="text-[10px] font-bold text-red-600 animate-pulse">
            {sosAlerts.length} SOS στον χάρτη
          </span>
        ) : null}
        <label className="flex items-center gap-2 font-bold cursor-pointer ml-auto xl:ml-0">
          <input type="checkbox" checked={showGeofence} onChange={(e) => setShowGeofence(e.target.checked)} />
          Geofence & alerts
        </label>
        {showGeofence ? (
          <span className="text-[10px] text-rose-600 font-bold">
            {mapAlerts.length} στον χάρτη
            {alertsWs ? ' · live' : ''}
          </span>
        ) : null}
      </div>

      {!mapbox ? (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2">
          Ορίστε <code className="font-mono">VITE_MAPBOX_TOKEN</code> στο <code className="font-mono">.env.local</code>{' '}
          για Mapbox GL. Προσωρινά χρησιμοποιείται Leaflet / CARTO.
        </p>
      ) : null}

      <AdminFleetPushPanel />

      {!vehicles.length && connected ? (
        <p className="text-sm text-gray-500 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
          Δεν υπάρχουν ενεργοί οδηγοί στον χάρτη. Ζητήστε από έναν οδηγό να πατήσει «Έναρξη Βάρδιας» στην εφαρμογή PWA.
        </p>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4">
        <div className="h-[min(72vh,620px)] rounded-[24px] overflow-hidden border border-black/[0.08] shadow-level-2">
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
        </div>
        <FleetEtaPanel activeTripCount={vehicles.length} />
      </div>
    </div>
  );
}
