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
import '../../styles/fleet-live-map.css';

/** Ζωντανός χάρτης στόλου — Apple-like UI, πόλεις & περιφέρειες Ελλάδας. */
export default function FleetLiveMapWebSocket() {
  const { connected, vehicles, tenantId, transport, pollError, lastPollAt } = useFleetTelemetryEgress();
  const mapbox = isMapboxEnabled();
  const [showHeat, setShowHeat] = useState(false);
  const [heatDays, setHeatDays] = useState(7);
  const [slowOnly, setSlowOnly] = useState(false);
  const [heatmap, setHeatmap] = useState([]);
  const [showGeofence, setShowGeofence] = useState(false);
  const [showSosPins, setShowSosPins] = useState(true);
  const [showPlaces, setShowPlaces] = useState(true);
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
    return [38.3, 23.5];
  }, [vehicles]);

  const selected = useMemo(
    () => vehicles.find((v) => v.id === selectedId) || vehicles[0] || null,
    [vehicles, selectedId],
  );

  const transportLabel =
    transport === 'poll' ? 'HTTP' : transport === 'ws' ? 'Live' : 'σύνδεση…';

  return (
    <div className="fleet-apple-shell space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="fleet-apple-title">Ζωντανός χάρτης στόλου</h2>
          <p className="fleet-apple-subtitle">
            {vehicles.length} ενεργά οχήματα · {transportLabel} {connected ? 'ενεργό' : 'εκτός'}
            {showHeat && heatmap.length ? ` · heatmap ${heatmap.length}` : ''}
            {tenantId ? ` · ${tenantId.slice(0, 8)}…` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setFitNonce((n) => n + 1)} className="fleet-apple-chip">
            <span className="material-symbols-outlined text-[16px]">center_focus_strong</span>
            Κέντρο στόλου
          </button>
          <span className={`fleet-apple-chip ${connected ? 'is-live' : 'is-warn'}`}>
            <span className="material-symbols-outlined text-[14px]">sensors</span>
            {connected ? 'Ζωντανά' : '…'}
          </span>
        </div>
      </div>

      <div className="fleet-apple-toolbar">
        <label>
          <input type="checkbox" checked={showPlaces} onChange={(e) => setShowPlaces(e.target.checked)} />
          Πόλεις &amp; περιφέρειες
        </label>
        <label>
          <input type="checkbox" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} />
          Heatmap GPS
        </label>
        {showHeat ? (
          <>
            <label>
              <span className="text-[10px] uppercase tracking-wide text-[var(--fleet-secondary)]">Περίοδος</span>
              <select value={heatDays} onChange={(e) => setHeatDays(Number(e.target.value))}>
                <option value={7}>7 ημέρες</option>
                <option value={30}>30 ημέρες</option>
                <option value={90}>90 ημέρες</option>
              </select>
            </label>
            <label>
              <input type="checkbox" checked={slowOnly} onChange={(e) => setSlowOnly(e.target.checked)} />
              Μόνο στάσεις (&lt;8 km/h)
            </label>
          </>
        ) : null}
        <label>
          <input type="checkbox" checked={showSosPins} onChange={(e) => setShowSosPins(e.target.checked)} />
          <span style={{ color: 'var(--fleet-danger)' }}>SOS</span>
        </label>
        {showSosPins && sosAlerts.length ? (
          <span className="text-[11px] font-semibold" style={{ color: 'var(--fleet-danger)' }}>
            {sosAlerts.length} στον χάρτη
          </span>
        ) : null}
        <label className="ml-auto xl:ml-0">
          <input type="checkbox" checked={showGeofence} onChange={(e) => setShowGeofence(e.target.checked)} />
          Geofence
        </label>
        {showGeofence ? (
          <span className="text-[11px] font-semibold text-[var(--fleet-secondary)]">
            {mapAlerts.length} alerts{alertsWs ? ' · live' : ''}
          </span>
        ) : null}
      </div>

      {!mapbox ? (
        <p className="fleet-apple-banner">
          Mapbox token προαιρετικό — χρησιμοποιείται μαλακό CARTO basemap με ελληνικές ετικέτες πόλεων &amp;
          περιφερειών.
        </p>
      ) : null}

      <AdminFleetPushPanel />

      {pollError ? <p className="fleet-apple-banner is-error">{pollError}</p> : null}

      {!vehicles.length && connected ? (
        <p className="fleet-apple-banner">
          Δεν υπάρχουν ενεργοί οδηγοί. Ζητήστε «Έναρξη βάρδιας» στην PWA με άδεια τοποθεσίας. Με «Τέλος βάρδιας»
          το pin αφαιρείται αμέσως.
        </p>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div className="fleet-apple-map-frame">
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
              showPlaces={showPlaces}
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
              showPlaces={showPlaces}
              focusSosAlert={showSosPins ? focusSosAlert : null}
              fitNonce={fitNonce}
            />
          )}
        </div>

        <div className="space-y-4">
          <div className="fleet-apple-side-card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold tracking-tight">Ενεργά οχήματα</h3>
              {lastPollAt ? (
                <span className="text-[11px] text-[var(--fleet-secondary)]">
                  {lastPollAt.toLocaleTimeString('el-GR')}
                </span>
              ) : null}
            </div>
            {vehicles.length ? (
              <ul className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
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
                        className={`fleet-apple-vehicle-btn ${active ? 'is-active' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={img}
                            alt=""
                            className="h-12 w-12 rounded-[14px] object-cover shadow-sm ring-2 ring-white"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold tracking-tight">{v.driver_name}</div>
                            <div className="truncate text-xs text-[var(--fleet-secondary)]">
                              {v.bus_plate} · #{v.trip_id ?? '—'}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-[var(--fleet-secondary)]">
                              <span>{Math.round(v.speed || 0)} km/h</span>
                              <span>
                                {Number(v.lat).toFixed(4)}, {Number(v.lng).toFixed(4)}
                              </span>
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
              <p className="text-xs text-[var(--fleet-secondary)]">Κανένα ενεργό όχημα αυτή τη στιγμή.</p>
            )}
          </div>
          <FleetEtaPanel activeTripCount={vehicles.length} />
        </div>
      </div>
    </div>
  );
}
