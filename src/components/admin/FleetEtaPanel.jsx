import { useEffect, useMemo, useState } from 'react';
import { fetchFleetEtas } from '../../services/telemetryApi.js';
import FleetPassengerTrackLinkButton from './FleetPassengerTrackLinkButton.jsx';

const TRAFFIC_LABELS = {
  light: { label: 'Ελαφριά κίνηση', tone: 'text-emerald-700 bg-emerald-50' },
  moderate: { label: 'Κανονική', tone: 'text-sky-700 bg-sky-50' },
  heavy: { label: 'Αυξημένη', tone: 'text-amber-800 bg-amber-50' },
  severe: { label: 'Έντονη', tone: 'text-rose-700 bg-rose-50' },
};

function formatDistance(m) {
  if (m == null) return '—';
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

function formatCountdown(seconds) {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}δ`;
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins}΄`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${h}ω ${rem}΄` : `${h}ω`;
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

  const traffic = TRAFFIC_LABELS[item.traffic_level] || TRAFFIC_LABELS.moderate;

  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="absolute inset-y-0 left-0 w-1 bg-[var(--color-primary,#0040df)]" aria-hidden />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {item.bus_plate || item.vehicle_code || '—'}
          </p>
          <h3 className="mt-0.5 truncate text-[15px] font-bold text-slate-900">
            {item.driver_name || 'Οδηγός'}
          </h3>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[28px] leading-none font-black tabular-nums tracking-tight text-[var(--color-primary,#0040df)]">
            {formatCountdown(remaining)}
          </p>
          <p className="mt-1 text-[10px] font-medium text-slate-400">έως στάση</p>
        </div>
      </div>

      <p className="mt-3 pl-2 text-sm text-slate-600">
        Επόμενη: <span className="font-semibold text-slate-900">{item.next_stop_name || '—'}</span>
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 pl-2">
        <span className="rounded-md bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
          {formatDistance(item.distance_m)}
        </span>
        <span className="rounded-md bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
          {Math.round(item.speed_kmh ?? 0)} km/h
        </span>
        <span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${traffic.tone}`}>
          {item.traffic_label || traffic.label}
        </span>
        <div className="ml-auto">
          <FleetPassengerTrackLinkButton tripId={item.trip_id} compact />
        </div>
      </div>
    </article>
  );
}

function LiveVehicleFallbackRow({ vehicle }) {
  return (
    <article className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">
            {vehicle.driver_name || 'Οδηγός'}
          </p>
          <p className="truncate font-mono text-[11px] text-slate-500">
            {vehicle.bus_plate || vehicle.vehicle_code || '—'}
            {vehicle.trip_id != null ? ` · #${vehicle.trip_id}` : ''}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            Live
          </span>
          <p className="mt-1 text-[11px] font-semibold tabular-nums text-slate-600">
            {Math.round(vehicle.speed ?? vehicle.speed_kmh ?? 0)} km/h
          </p>
        </div>
      </div>
    </article>
  );
}

/** Πλευρικό panel ETA — επόμενες στάσεις ενεργών οδηγών. */
export default function FleetEtaPanel({
  vehicles = [],
  connected = false,
  transport = 'connecting',
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const pollMs = useMemo(() => (data?.push_seconds || 30) * 1000, [data?.push_seconds]);

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
          if (!cancelled) {
            setError(err.message || 'Αποτυχία φόρτωσης ETA');
            // Keep last good payload if we have one.
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    const id = setInterval(load, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollMs, vehicles.length]);

  const items = data?.items || [];
  const etaTripIds = useMemo(
    () => new Set(items.map((item) => Number(item.trip_id)).filter((n) => Number.isFinite(n))),
    [items],
  );
  const onlineWithoutEta = useMemo(
    () =>
      vehicles.filter((v) => {
        const tid = v.trip_id != null ? Number(v.trip_id) : null;
        return tid == null || !etaTripIds.has(tid);
      }),
    [vehicles, etaTripIds],
  );

  const trafficMode = !data
    ? null
    : data.google_maps_configured
      ? 'Google Traffic'
      : 'Εκτίμηση απόστασης';

  const statusTone = connected
    ? vehicles.length
      ? 'bg-emerald-50 text-emerald-800'
      : 'bg-amber-50 text-amber-900'
    : 'bg-slate-100 text-slate-600';

  const statusLabel = !connected
    ? 'Σύνδεση…'
    : vehicles.length
      ? `${vehicles.length} online`
      : 'Χωρίς online οδηγούς';

  return (
    <aside className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)] xl:max-h-[min(72vh,620px)]">
      <header className="border-b border-slate-100 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-1.5 text-[15px] font-bold text-slate-900">
              <span className="material-symbols-outlined text-[20px] text-[var(--color-primary,#0040df)]">
                schedule
              </span>
              Live ETA
            </h3>
            <p className="mt-1 text-[11px] text-slate-500">
              Ανανέωση {data?.push_seconds || 30}δ
              {trafficMode ? ` · ${trafficMode}` : ''}
              {transport === 'poll' ? ' · poll' : transport === 'ws' ? ' · live feed' : ''}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusTone}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                connected && vehicles.length ? 'bg-emerald-500 animate-pulse' : 'bg-current opacity-50'
              }`}
              aria-hidden
            />
            {statusLabel}
          </span>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {loading && !items.length ? (
          <div className="space-y-3 py-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : null}

        {error && !items.length ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/80 px-3.5 py-3 text-[13px] text-amber-950">
            <p className="font-semibold">Δεν φορτώθηκε το ETA</p>
            <p className="mt-1 text-amber-800/90">{error}</p>
            {vehicles.length ? (
              <p className="mt-2 text-amber-800/80">
                Εμφανίζονται οι online οδηγοί από τον χάρτη μέχρι να επανέλθει η σύνδεση.
              </p>
            ) : null}
          </div>
        ) : null}

        {items.map((item) => (
          <EtaRow key={`${item.trip_id}-${item.vehicle_id}`} item={item} />
        ))}

        {!items.length && !loading && onlineWithoutEta.length > 0
          ? onlineWithoutEta.map((v) => (
              <LiveVehicleFallbackRow
                key={v.id || v.vehicle_id || `${v.bus_plate}-${v.trip_id}`}
                vehicle={v}
              />
            ))
          : null}

        {!items.length && !vehicles.length && !loading ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
              <span className="material-symbols-outlined text-[28px]">near_me_disabled</span>
            </div>
            <p className="text-sm font-semibold text-slate-800">Κανένας οδηγός online</p>
            <p className="mt-1.5 max-w-[220px] text-[12px] leading-relaxed text-slate-500">
              Όταν ο οδηγός πατήσει «Έναρξη βάρδιας» στο PWA, εμφανίζεται εδώ το ETA επόμενης στάσης.
            </p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
