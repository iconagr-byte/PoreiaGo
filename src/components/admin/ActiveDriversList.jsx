import { useFleetTelemetryEgress } from '../../context/FleetTelemetryContext.jsx';
import FleetDriverPlaybackButton from './FleetDriverPlaybackButton.jsx';
import FleetPassengerTrackLinkButton from './FleetPassengerTrackLinkButton.jsx';
import { navigateToDriverTodayPlayback } from '../../lib/admin/fleetPlaybackNav.js';
import { useNavigate } from 'react-router-dom';

export default function ActiveDriversList() {
  const { connected, vehicles } = useFleetTelemetryEgress();
  const navigate = useNavigate();

  if (!vehicles.length) {
    return (
      <div className="rounded-[28px] border border-black/[0.06] bg-white p-10 text-center text-gray-500">
        <span className="material-symbols-outlined text-5xl text-gray-300 block mb-3">directions_bus</span>
        Δεν υπάρχουν ενεργοί οδηγοί online.
        {!connected && <p className="text-xs mt-2 text-amber-600">Σύνδεση WebSocket…</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Ενεργοί Οδηγοί</h2>
        <span className="text-sm text-gray-500">{vehicles.length} online</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {vehicles.map((v) => (
          <article
            key={v.id}
            role="button"
            tabIndex={0}
            onClick={() => navigateToDriverTodayPlayback(navigate, v)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigateToDriverTodayPlayback(navigate, v);
              }
            }}
            className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-lg">{v.driver_name}</h3>
                <p className="text-sm text-gray-500 font-mono">{v.bus_plate}</p>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                ΖΩΝΤΑΝΑ
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[10px] uppercase text-gray-400 font-bold">Ταχύτητα</dt>
                <dd className="font-bold text-primary">{Math.round(v.speed)} km/h</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase text-gray-400 font-bold">Δρομολόγιο</dt>
                <dd className="font-bold">{v.trip_id ?? '—'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[10px] uppercase text-gray-400 font-bold">Τελευταία θέση</dt>
                <dd className="font-mono text-xs text-gray-600">
                  {v.lat?.toFixed(5)}, {v.lng?.toFixed(5)}
                </dd>
              </div>
            </dl>
            <div
              className="mt-4 pt-3 border-t border-black/[0.04] flex flex-wrap gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <FleetDriverPlaybackButton vehicle={v} />
              <FleetPassengerTrackLinkButton tripId={v.trip_id} compact />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
