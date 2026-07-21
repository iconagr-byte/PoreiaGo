import { useEffect, useMemo, useState } from 'react';
import { useFleetTelemetryEgress } from '../../context/FleetTelemetryContext.jsx';
import { isMapboxEnabled } from '../../lib/maps/mapboxConfig.js';
import { fetchHeatmap, fetchGeofenceMapLayers } from '../../services/telemetryApi.js';
import { useTelemetryAlerts } from '../../hooks/useTelemetryAlerts.js';
import { mapSosAlertsWithCoords, mapTelemetryAlertsWithCoords } from '../../lib/admin/fleetMapAlerts.js';
import {
  formatBoardingLabel,
  formatUpdatedAgo,
  resolveFleetMarkerImage,
} from '../../lib/admin/fleetVehicleDetails.js';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';
import FleetLiveMapLeaflet from './FleetLiveMapLeaflet.jsx';
import FleetLiveMapMapbox from './FleetLiveMapMapbox.jsx';
import AdminFleetPushPanel from './AdminFleetPushPanel.jsx';
import FleetEtaPanel from './FleetEtaPanel.jsx';

/** Ζωντανός χάρτης στόλου — Mapbox αν υπάρχει token, αλλιώς Leaflet. */
export default function FleetLiveMapWebSocket() {
  const { connected, vehicles, tenantId, transport, pollError, lastPollAt } = useFleetTelemetryEgress();
  const mapbox = isMapboxEnabled();
  const [showHeat, setShowHeat] = useState(false);
  const [heatDays, setHeatDays] = useState(7);
  const [slowOnly, setSlowOnly] = useState(false);
  const [heatmap, setHeatmap] = useState([]);
  const [showGeofence, setShowGeofence] = useState(false);
  const [showSosPins, setShowSosPins] = useState(true);
  const [geofenceLayers, setGeofenceLayers] = useState(null);
  const [fitNonce, setFitNonce] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

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

  const selected = useMemo(
    () => vehicles.find((v) => v.id === selectedId) || vehicles[0] || null,
    [vehicles, selectedId],
  );

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
            {mapbox ? 'Mapbox GL' : 'Leaflet'}
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFitNonce((n) => n + 1)}
            className="inline-flex items-center gap-1 rounded-xl border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[16px]">center_focus_strong</span>
            Κέντρο στόλου
          </button>
          <span
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
              connected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">sensors</span>
            {connected ? (transport === 'poll' ? 'LIVE (poll)' : 'ΖΩΝΤΑΝΑ') : '…'}
          </span>
        </div>
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

      {pollError ? (
        <p className="text-sm text-rose-800 rounded-xl bg-rose-50 border border-rose-100 px-4 py-3">
          {pollError}
        </p>
      ) : null}

      {!vehicles.length && connected ? (
        <p className="text-sm text-gray-500 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
          Δεν υπάρχουν ενεργοί οδηγοί στον χάρτη. Όταν ο οδηγός πατήσει «Τέλος βάρδιας» στο κινητό, το pin
          αφαιρείται αμέσως. Για εμφάνιση, ζητήστε «Έναρξη βάρδιας» στην PWA με άδεια τοποθεσίας.
        </p>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div className="h-[min(72vh,640px)] rounded-[24px] overflow-hidden border border-black/[0.08] shadow-level-2 relative">
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
              fitNonce={fitNonce}
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
              fitNonce={fitNonce}
            />
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-black/[0.06] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">Ενεργά οχήματα</h3>
              {lastPollAt ? (
                <span className="text-[11px] text-slate-400">
                  {lastPollAt.toLocaleTimeString('el-GR')}
                </span>
              ) : null}
            </div>
            {vehicles.length ? (
              <ul className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {vehicles.map((v) => {
                  const img = resolveSiteAssetUrl(resolveFleetMarkerImage(v));
                  const active = (selected?.id || selectedId) === v.id;
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(v.id);
                          setFitNonce((n) => n + 1);
                        }}
                        className={`w-full rounded-2xl border px-3 py-2.5 text-left transition ${
                          active
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-black/[0.06] bg-slate-50/80 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={img}
                            alt=""
                            className="h-12 w-12 rounded-xl object-cover ring-2 ring-white shadow"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold text-slate-900">{v.driver_name}</div>
                            <div className="truncate text-xs text-slate-500">
                              {v.bus_plate} · δρομολόγιο #{v.trip_id ?? '—'}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-600">
                              <span>{Math.round(v.speed || 0)} km/h</span>
                              <span>{Number(v.lat).toFixed(4)}, {Number(v.lng).toFixed(4)}</span>
                              <span>{formatUpdatedAgo(v.timestamp) || '—'}</span>
                              {formatBoardingLabel(v) ? <span>{formatBoardingLabel(v)}</span> : null}
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">Κανένα ενεργό όχημα αυτή τη στιγμή.</p>
            )}
          </div>
          <FleetEtaPanel activeTripCount={vehicles.length} />
        </div>
      </div>
    </div>
  );
}
