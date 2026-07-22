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
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';
import FleetLiveMapLeaflet from './FleetLiveMapLeaflet.jsx';
import FleetLiveMapMapbox from './FleetLiveMapMapbox.jsx';
import AdminFleetPushPanel from './AdminFleetPushPanel.jsx';
import FleetEtaPanel from './FleetEtaPanel.jsx';
import FleetVehicleHistoryModal from './FleetVehicleHistoryModal.jsx';

/** Ζωντανός χάρτης στόλου — μεγάλος χάρτης, χωρίς βαριά toolbar. */
export default function FleetLiveMapWebSocket() {
  const { connected, vehicles, tenantId, transport, pollError, lastPollAt } = useFleetTelemetryEgress();
  const mapbox = isMapboxEnabled();
  const [fitNonce, setFitNonce] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [historyVehicle, setHistoryVehicle] = useState(null);

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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Ζωντανός χάρτης</h2>
          <p className="text-xs text-slate-500">
            {vehicles.length} ενεργά · {connected ? 'ζωντανά' : 'εκτός'}
            {transport === 'poll' ? ' (poll)' : ''}
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
            {connected ? 'LIVE' : '…'}
          </span>
        </div>
      </div>

      {pollError ? (
        <p className="text-sm text-rose-800 rounded-xl bg-rose-50 border border-rose-100 px-4 py-3">
          {pollError}
        </p>
      ) : null}

      {!vehicles.length && connected ? (
        <p className="text-sm text-gray-500 rounded-xl bg-gray-50 border border-gray-100 px-4 py-2">
          Δεν υπάρχουν ενεργοί οδηγοί. Ζητήστε «Έναρξη βάρδιας» στην PWA με άδεια τοποθεσίας.
        </p>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-3">
        <div className="h-[min(88vh,920px)] min-h-[520px] rounded-[24px] overflow-hidden border border-black/[0.08] shadow-level-2 relative">
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
              focusSosAlert={focusSosAlert}
              fitNonce={fitNonce}
              onVehicleHistory={setHistoryVehicle}
            />
          )}
        </div>

        <div className="space-y-3">
          <div className="rounded-[24px] border border-black/[0.06] bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">Ενεργά οχήματα</h3>
              {lastPollAt ? (
                <span className="text-[11px] text-slate-400">
                  {lastPollAt.toLocaleTimeString('el-GR')}
                </span>
              ) : null}
            </div>
            <p className="mb-2 text-[11px] text-slate-400">Διπλό κλικ για ιστορικό &amp; check-in</p>
            {vehicles.length ? (
              <ul className="space-y-2 max-h-[min(60vh,560px)] overflow-y-auto pr-1">
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
              <p className="text-xs text-slate-500">Κανένα ενεργό όχημα αυτή τη στιγμή.</p>
            )}
          </div>
          <AdminFleetPushPanel />
          <FleetEtaPanel activeTripCount={vehicles.length} />
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
