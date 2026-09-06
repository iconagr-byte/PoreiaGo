import { useEffect, useState } from 'react';
import { loadVehicleTripHistory } from '../../lib/admin/fleetVehicleHistory.js';
import { resolveFleetMarkerImage } from '../../lib/admin/fleetVehicleDetails.js';
import FleetDriverPlaybackButton from './FleetDriverPlaybackButton.jsx';

function formatKm(km) {
  if (!Number.isFinite(km)) return '—';
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

function formatDuration(min) {
  if (!Number.isFinite(min)) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h <= 0) return `${m} λεπτά`;
  return `${h}ώ ${String(m).padStart(2, '0')}λ`;
}

function formatClock(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

/** Modal ιστορικού διαδρομής + χλμ + check-in ανά στάση. */
export default function FleetVehicleHistoryModal({ vehicle, open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!open || !vehicle) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setData(null);
    loadVehicleTripHistory(vehicle)
      .then((row) => {
        if (!cancelled) setData(row);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Αποτυχία φόρτωσης ιστορικού');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, vehicle?.id, vehicle?.trip_id, vehicle?.driver_id]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !vehicle) return null;

  const img = resolveFleetMarkerImage(vehicle);

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Ιστορικό διαδρομής"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-label="Κλείσιμο"
        onClick={onClose}
      />
      <div className="relative z-[1] flex max-h-[min(92vh,820px)] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border border-black/[0.08] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <header className="flex items-start gap-3 border-b border-black/[0.06] px-5 py-4">
          <img src={img} alt="" className="h-14 w-14 rounded-2xl object-cover ring-2 ring-white shadow" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Ιστορικό βάρδιας</p>
            <h2 className="truncate text-lg font-bold tracking-tight text-slate-900">
              {vehicle.driver_name || 'Οδηγός'}
            </h2>
            <p className="truncate text-sm text-slate-500">
              {vehicle.bus_plate || '—'} · δρομολόγιο #{vehicle.trip_id ?? '—'}
              {data?.trip?.title ? ` · ${data.trip.title}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Κλείσιμο"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading ? (
            <p className="text-sm text-slate-500 py-8 text-center">Φόρτωση ιστορικού…</p>
          ) : null}
          {error ? (
            <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </p>
          ) : null}

          {data ? (
            <>
              <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-2xl bg-slate-50 border border-black/[0.04] px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Χιλιόμετρα</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{formatKm(data.km)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 border border-black/[0.04] px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Διάρκεια</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
                    {formatDuration(data.durationMin)}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 border border-black/[0.04] px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Μέση ταχύτητα</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
                    {Number.isFinite(data.avgSpeed) ? `${Math.round(data.avgSpeed)} km/h` : '—'}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 border border-black/[0.04] px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">GPS σημεία</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{data.pointCount}</p>
                </div>
              </section>

              <section className="rounded-2xl border border-black/[0.06] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900">Ιστορικό διαδρομής σήμερα</h3>
                  <FleetDriverPlaybackButton vehicle={vehicle} />
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {data.pointCount
                    ? `${formatClock(data.fromTime)} → ${formatClock(data.toTime)} · ${data.pointCount} σημεία GPS`
                    : 'Δεν υπάρχουν ακόμα καταγεγραμμένα GPS σημεία για σήμερα.'}
                </p>
                {data.points?.length > 1 ? (
                  <div className="mt-3 h-16 overflow-hidden rounded-xl bg-gradient-to-r from-sky-50 via-emerald-50 to-amber-50 border border-black/[0.04] relative">
                    <RouteSparkline points={data.points} />
                  </div>
                ) : null}
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900">Check-in επιβατών ανά στάση</h3>
                  <span className="text-xs font-semibold text-slate-500">
                    {data.boarding?.progress_label ||
                      `${data.boarding?.boarded_count ?? 0}/${data.boarding?.capacity ?? '—'}`}
                  </span>
                </div>
                <ul className="space-y-3">
                  {data.checkinsByStop.map((stop) => (
                    <li
                      key={stop.id}
                      className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{stop.name}</p>
                          {stop.time ? (
                            <p className="text-xs text-slate-500 mt-0.5">Προγραμματισμένο {stop.time}</p>
                          ) : null}
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold px-2 py-0.5">
                          {stop.boarded.length} επιβιβ.
                        </span>
                      </div>

                      {stop.boarded.length ? (
                        <ul className="mt-2 space-y-1.5">
                          {stop.boarded.map((p) => (
                            <li
                              key={p.booking_id || `${p.passenger_name}-${p.seat_number}`}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <span className="truncate text-slate-800">
                                <span className="material-symbols-outlined text-[14px] text-emerald-600 align-middle mr-1">
                                  check_circle
                                </span>
                                {p.passenger_name || 'Επιβάτης'}
                                {p.seat_number ? (
                                  <span className="text-slate-400"> · θέση {p.seat_number}</span>
                                ) : null}
                              </span>
                              <span className="shrink-0 text-[11px] text-slate-400 tabular-nums">
                                {formatClock(p.boarded_at)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-xs text-slate-400">Κανένα check-in σε αυτή τη στάση ακόμα.</p>
                      )}

                      {stop.missing?.length ? (
                        <div className="mt-3 border-t border-dashed border-slate-200 pt-2">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 mb-1">
                            Εκκρεμεί επιβίβαση
                          </p>
                          <ul className="space-y-1">
                            {stop.missing.map((p) => (
                              <li
                                key={p.booking_id || `${p.passenger_name}-miss`}
                                className="text-sm text-slate-600 truncate"
                              >
                                {p.passenger_name || 'Επιβάτης'}
                                {p.seat_number ? ` · θέση ${p.seat_number}` : ''}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Tiny SVG path from GPS points (normalized). */
function RouteSparkline({ points }) {
  const sample = points.length > 80 ? points.filter((_, i) => i % Math.ceil(points.length / 80) === 0) : points;
  const lats = sample.map((p) => p.lat);
  const lngs = sample.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const w = 320;
  const h = 64;
  const pad = 6;
  const sx = (lng) => pad + ((lng - minLng) / Math.max(1e-9, maxLng - minLng)) * (w - pad * 2);
  const sy = (lat) => pad + ((maxLat - lat) / Math.max(1e-9, maxLat - minLat)) * (h - pad * 2);
  const d = sample
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.lng).toFixed(1)},${sy(p.lat).toFixed(1)}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" aria-hidden>
      <path d={d} fill="none" stroke="#0071e3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {sample.length ? (
        <>
          <circle cx={sx(sample[0].lng)} cy={sy(sample[0].lat)} r="3.5" fill="#34c759" />
          <circle
            cx={sx(sample[sample.length - 1].lng)}
            cy={sy(sample[sample.length - 1].lat)}
            r="3.5"
            fill="#ff3b30"
          />
        </>
      ) : null}
    </svg>
  );
}
