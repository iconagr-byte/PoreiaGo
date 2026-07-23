import { useEffect, useState } from 'react';
import { fetchFleetEtas } from '../../services/telemetryApi.js';
import FleetPassengerTrackLinkButton from './FleetPassengerTrackLinkButton.jsx';
import { LIVE_REFRESH_MS, LIVE_REFRESH_SEC } from '../../lib/liveRefresh.js';

const TRAFFIC_TONES = {
  light: 'bg-emerald-100 text-emerald-800',
  moderate: 'bg-sky-100 text-sky-800',
  heavy: 'bg-amber-100 text-amber-800',
  severe: 'bg-red-100 text-red-800',
};

function formatDistance(m) {
  if (m == null) return '—';
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${m} m`;
}

function formatCountdown(seconds) {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds} δευτ.`;
  const mins = Math.max(1, Math.round(seconds / 60));
  return `${mins} λεπτά`;
}

function EtaRow({ item }) {
  const [remaining, setRemaining] = useState(item.eta_seconds ?? 0);

  useEffect(() => {
    const base = item.eta_seconds ?? 0;
    const computedAt = item.computed_at ? new Date(item.computed_at).getTime() : Date.now();
    const tick = () => {
      const elapsed = Math.floor((Date.now() - computedAt) / 1000);
      setRemaining(Math.max(0, base - elapsed));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [item.eta_seconds, item.computed_at]);

  const trafficClass = TRAFFIC_TONES[item.traffic_level] || TRAFFIC_TONES.moderate;

  return (
    <article className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold truncate">{item.driver_name || '—'}</h3>
          <p className="text-xs text-gray-500 font-mono truncate">{item.bus_plate || item.vehicle_code}</p>
        </div>
        <span className="text-[10px] font-bold text-gray-400">#{item.trip_id}</span>
      </div>

      <p className="mt-3 text-2xl font-black text-primary tabular-nums">{formatCountdown(remaining)}</p>
      <p className="text-xs text-gray-600 mt-1">
        → <strong>{item.next_stop_name}</strong>
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-[10px] uppercase text-gray-400 font-bold">Απόσταση</dt>
          <dd className="font-bold">{formatDistance(item.distance_m)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase text-gray-400 font-bold">Ταχύτητα</dt>
          <dd className="font-bold">{Math.round(item.speed_kmh ?? 0)} km/h</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${trafficClass}`}>
          {item.traffic_label || item.traffic_level}
        </span>
        <div className="flex items-center gap-2">
          <FleetPassengerTrackLinkButton tripId={item.trip_id} compact />
          <span className="text-[10px] text-gray-400">
            {item.computed_at ? new Date(item.computed_at).toLocaleTimeString('el-GR') : '—'}
          </span>
        </div>
      </div>
    </article>
  );
}

/** Πλευρικό panel ETA — επόμενες στάσεις ενεργών οδηγών. */
export default function FleetEtaPanel({ activeTripCount = 0 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchFleetEtas()
        .then((result) => {
          if (!cancelled) {
            setData(result);
            setError('');
          }
        })
        .catch((err) => {
          if (!cancelled) setError(err.message || 'Αποτυχία φόρτωσης ETA');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    const id = setInterval(load, LIVE_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeTripCount]);

  const items = data?.items || [];

  return (
    <aside className="rounded-[24px] border border-black/[0.08] bg-gradient-to-b from-slate-50 to-white p-4 h-full min-h-[280px] xl:max-h-[min(72vh,620px)] overflow-y-auto">
      <div className="flex items-center justify-between gap-2 mb-4 sticky top-0 bg-gradient-to-b from-slate-50 to-slate-50/95 pb-2 z-10">
        <div>
          <h3 className="font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px] text-primary">schedule</span>
            Live ETA
          </h3>
          <p className="text-[10px] text-gray-500">
            refresh {LIVE_REFRESH_SEC}s
            {data?.google_maps_configured ? ' · Google Traffic' : ' · mock ETA'}
          </p>
        </div>
        {loading ? <span className="text-[10px] text-gray-400">…</span> : null}
      </div>

      {error ? (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
          {error}
        </p>
      ) : null}

      {!items.length && !loading ? (
        <p className="text-sm text-gray-500 text-center py-8">
          Δεν υπάρχουν ενεργά δρομολόγια με ETA. Οι οδηγοί πρέπει να είναι online στον χάρτη.
        </p>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <EtaRow key={`${item.trip_id}-${item.vehicle_id}`} item={item} />
        ))}
      </div>
    </aside>
  );
}
