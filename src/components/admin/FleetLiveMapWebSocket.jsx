import { useMemo, useState } from 'react';
import { useFleetTelemetryEgress } from '../../context/FleetTelemetryContext.jsx';
import { isMapboxEnabled } from '../../lib/maps/mapboxConfig.js';
import { useTelemetryAlerts } from '../../hooks/useTelemetryAlerts.js';
import { mapSosAlertsWithCoords } from '../../lib/admin/fleetMapAlerts.js';
import {
  formatBoardingLabel,
  formatUpdatedAgo,
  resolveFleetMarkerImage,
} from '../../lib/admin/fleetVehicleDetails.js';
import { resolveVehicleTripTitle } from '../../lib/admin/fleetBusPillLabel.js';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';
import FleetLiveMapLeaflet from './FleetLiveMapLeaflet.jsx';
import FleetLiveMapMapbox from './FleetLiveMapMapbox.jsx';
import AdminFleetPushPanel from './AdminFleetPushPanel.jsx';
import FleetEtaPanel from './FleetEtaPanel.jsx';
import FleetVehicleHistoryModal from './FleetVehicleHistoryModal.jsx';
import DriverOfficeChatPanel from './DriverOfficeChatPanel.jsx';
import '../../styles/fleet-live-map.css';

/** Ζωντανός χάρτης στόλου — Apple-like chrome, μαλακό basemap, ελληνικές ετικέτες. */
export default function FleetLiveMapWebSocket() {
  const { connected, vehicles, tenantId, transport, pollError, lastPollAt } = useFleetTelemetryEgress();
  const mapbox = isMapboxEnabled();
  const [fitNonce, setFitNonce] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [historyVehicle, setHistoryVehicle] = useState(null);
  const [showPlaces, setShowPlaces] = useState(true);
  const [showTrails, setShowTrails] = useState(true);

  // SOS pins always on (χωρίς toggle UI) — κρίσιμο για ασφάλεια.
  const { alerts } = useTelemetryAlerts({ tenantId, limit: 80, enabled: true });
  const sosAlerts = useMemo(() => mapSosAlertsWithCoords(alerts), [alerts]);
  const focusSosAlert = sosAlerts[0] ?? null;

  const center = useMemo(() => {
    if (vehicles.length) return [vehicles[0].lat, vehicles[0].lng];
    return [38.5, 23.0];
  }, [vehicles]);

  const selected = useMemo(
    () => vehicles.find((v) => v.id === selectedId) || vehicles[0] || null,
    [vehicles, selectedId],
  );

  return (
    <div className="fleet-apple-shell space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="fleet-apple-title">Ζωντανός χάρτης</h2>
          <p className="fleet-apple-subtitle">
            {vehicles.length} ενεργά · {connected ? 'ζωντανά' : 'εκτός'}
            {transport === 'poll' ? ' · ενημέρωση 5s' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPlaces((v) => !v)}
            className={`fleet-apple-chip ${showPlaces ? 'is-on' : ''}`}
            aria-pressed={showPlaces}
          >
            <span className="material-symbols-outlined text-[16px]">location_city</span>
            Ονόματα τόπων
          </button>
          <button
            type="button"
            onClick={() => setShowTrails((v) => !v)}
            className={`fleet-apple-chip ${showTrails ? 'is-on' : ''}`}
            aria-pressed={showTrails}
          >
            <span className="material-symbols-outlined text-[16px]">route</span>
            Ίχνος διαδρομής
          </button>
          <button
            type="button"
            onClick={() => setFitNonce((n) => n + 1)}
            className="fleet-apple-chip"
          >
            <span className="material-symbols-outlined text-[16px]">center_focus_strong</span>
            Κέντρο στόλου
          </button>
          <span className={`fleet-apple-chip ${connected ? 'is-live' : 'is-warn'}`}>
            <span className="material-symbols-outlined text-[14px]">sensors</span>
            {connected ? 'Ζωντανά' : '…'}
          </span>
        </div>
      </div>

      {pollError ? <p className="fleet-apple-banner is-error">{pollError}</p> : null}

      {!vehicles.length && connected ? (
        <p className="fleet-apple-banner">
          Δεν υπάρχουν ενεργοί οδηγοί. Ζητήστε «Έναρξη βάρδιας» στην PWA με άδεια τοποθεσίας.
        </p>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-3">
        <div className="fleet-apple-map-frame">
          {mapbox ? (
            <FleetLiveMapMapbox
              vehicles={vehicles}
              heatmap={[]}
              showHeat={false}
              geofenceLayers={null}
              mapAlerts={[]}
              sosAlerts={sosAlerts}
              showGeofence={false}
              showSosPins
              showPlaces={showPlaces}
              showTrails={showTrails}
              focusSosAlert={focusSosAlert}
              fitNonce={fitNonce}
              onVehicleHistory={setHistoryVehicle}
            />
          ) : (
            <FleetLiveMapLeaflet
              vehicles={vehicles}
              center={center}
              heatmap={[]}
              showHeat={false}
              geofenceLayers={null}
              mapAlerts={[]}
              sosAlerts={sosAlerts}
              showGeofence={false}
              showSosPins
              showPlaces={showPlaces}
              showTrails={showTrails}
              focusSosAlert={focusSosAlert}
              fitNonce={fitNonce}
              onVehicleHistory={setHistoryVehicle}
            />
          )}
        </div>

        <div className="space-y-4">
          <div className="fleet-apple-side-card">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold tracking-tight">Ενεργά οχήματα</h3>
              {lastPollAt ? (
                <span className="text-[11px] text-[var(--fleet-secondary)]">
                  {lastPollAt.toLocaleTimeString('el-GR')}
                </span>
              ) : null}
            </div>
            <p className="mb-3 text-[11px] text-[var(--fleet-secondary)]">
              Διπλό κλικ για ιστορικό &amp; check-in
            </p>
            {vehicles.length ? (
              <ul className="max-h-[min(52vh,480px)] space-y-2 overflow-y-auto pr-1">
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
                        onDoubleClick={() => setHistoryVehicle(v)}
                        title="Διπλό κλικ: ιστορικό διαδρομής"
                        className={`fleet-apple-vehicle-btn ${active ? 'is-active' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={img}
                            alt=""
                            className="h-12 w-12 rounded-[14px] object-cover ring-2 ring-white shadow"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold tracking-tight">{v.driver_name}</div>
                            <div className="truncate text-xs text-[var(--fleet-secondary)]">
                              {(() => {
                                const trip = resolveVehicleTripTitle(v);
                                return trip
                                  ? `${v.bus_plate} · ${trip}`
                                  : `${v.bus_plate} · δρομολόγιο #${v.trip_id ?? '—'}`;
                              })()}
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

          <div className="fleet-apple-side-card">
            <AdminFleetPushPanel />
          </div>

          <div className="fleet-apple-side-card">
            <DriverOfficeChatPanel
              compact
              driverId={selected?.driver_id || selected?.driverId || null}
              driverName={selected?.driver_name || selected?.driverName}
              tripId={selected?.trip_id ?? selected?.tripId ?? null}
            />
          </div>

          <div className="fleet-apple-side-card">
            <FleetEtaPanel activeTripCount={vehicles.length} />
          </div>
        </div>
      </div>

      <FleetVehicleHistoryModal
        open={Boolean(historyVehicle)}
        vehicle={historyVehicle}
        onClose={() => setHistoryVehicle(null)}
      />
    </div>
  );
}
