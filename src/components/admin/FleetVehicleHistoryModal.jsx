import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadVehicleTripHistory } from '../../lib/admin/fleetVehicleHistory.js';
import {
  formatUpdatedAgo,
  resolveFleetMarkerImage,
} from '../../lib/admin/fleetVehicleDetails.js';
import {
  formatFleetGpsSourceBadge,
  formatFleetGpsSourceChipLabel,
  resolveFleetGpsSource,
} from '../../lib/admin/fleetGpsSourceBadge.js';
import { resolveVehicleTripTitle } from '../../lib/admin/fleetBusPillLabel.js';
import { buildFleetPlaybackSearchParams } from '../../lib/admin/fleetPlaybackNav.js';
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

function formatCoords(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '—';
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function sourceLabel(source) {
  const kind = resolveFleetGpsSource({ source });
  if (kind === 'teltonika') return formatFleetGpsSourceChipLabel('teltonika');
  if (kind === 'app') return 'App οδηγού';
  if (source) return String(source);
  return 'GPS';
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const TABS = [
  { id: 'overview', label: 'Επισκόπηση', icon: 'dashboard' },
  { id: 'sessions', label: 'Είσοδος / έξοδος', icon: 'login' },
  { id: 'points', label: 'Στίγματα', icon: 'my_location' },
  { id: 'boarding', label: 'Check-in', icon: 'group' },
];

/** Modal ιστορικού διαδρομής — sessions, στίγματα, check-in. */
export default function FleetVehicleHistoryModal({ vehicle, open, onClose }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('overview');
  const [selectedPointIdx, setSelectedPointIdx] = useState(null);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (!open || !vehicle) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setData(null);
    setTab('overview');
    setSelectedPointIdx(null);
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
  }, [open, vehicle?.id, vehicle?.trip_id, vehicle?.driver_id, vehicle?.bus_plate]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const points = data?.points || [];
  const sessions = data?.sessions || [];
  const selectedPoint =
    selectedPointIdx != null && points[selectedPointIdx] ? points[selectedPointIdx] : null;

  const tripTitle = useMemo(() => {
    if (data?.trip?.title) return data.trip.title;
    return resolveVehicleTripTitle(vehicle) || '';
  }, [data?.trip?.title, vehicle]);

  const gpsBadge = formatFleetGpsSourceBadge(vehicle);
  const gpsKind = resolveFleetGpsSource(vehicle);
  const updatedAgo = formatUpdatedAgo(vehicle?.timestamp || vehicle?.updated_at);
  const liveSpeed = Math.round(Number(vehicle?.speed || vehicle?.speed_kmh || 0) || 0);
  const heading =
    vehicle?.heading != null || vehicle?.heading_deg != null
      ? Math.round(Number(vehicle.heading ?? vehicle.heading_deg))
      : null;

  const openFullHistory = () => {
    const tripId = vehicle?.trip_id ?? vehicle?.tripId;
    if (tripId) {
      const params = buildFleetPlaybackSearchParams({
        tripId,
        driverId: vehicle?.driver_id ?? vehicle?.driverId,
        driverName: vehicle?.driver_name ?? vehicle?.driverName,
        date: 'today',
      });
      navigate(`/admin?${params.toString()}`);
      onClose?.();
      return;
    }
    navigate('/admin?tab=fleet_route_playback&subtab=playback');
    onClose?.();
  };

  const handleCopy = async (key, text) => {
    const ok = await copyText(text);
    if (!ok) return;
    setCopied(key);
    window.setTimeout(() => setCopied((c) => (c === key ? '' : c)), 1600);
  };

  if (!open || !vehicle) return null;

  const img = resolveFleetMarkerImage(vehicle);
  const plate = vehicle.bus_plate || vehicle.vehicle_code || '—';

  return (
    <div
      className="fleet-history-modal fixed inset-0 z-[1200] flex items-end sm:items-center justify-center p-2 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Ιστορικό διαδρομής"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[3px]"
        aria-label="Κλείσιμο"
        onClick={onClose}
      />
      <div className="relative z-[1] flex max-h-[min(94vh,880px)] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-white/40 bg-[#f5f7fb] shadow-[0_28px_90px_rgba(15,23,42,0.35)]">
        <header className="fleet-history-modal__hero relative overflow-hidden px-5 pt-5 pb-4 text-white">
          <div className="relative flex items-start gap-3">
            <img
              src={img}
              alt=""
              className="h-16 w-16 rounded-[18px] object-cover ring-2 ring-white/30 shadow-lg"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">
                  Ιστορικό κίνησης GPS
                </p>
                {gpsBadge ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      gpsKind === 'teltonika'
                        ? 'bg-emerald-400/25 text-emerald-50 ring-1 ring-emerald-200/40'
                        : 'bg-sky-400/25 text-sky-50 ring-1 ring-sky-200/40'
                    }`}
                  >
                    {gpsBadge}
                  </span>
                ) : null}
                {updatedAgo ? (
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold text-white/90">
                    {updatedAgo}
                  </span>
                ) : null}
              </div>
              <h2 className="mt-1 truncate text-xl font-bold tracking-tight">
                {vehicle.driver_name && vehicle.driver_name !== '—'
                  ? vehicle.driver_name
                  : plate}
              </h2>
              <p className="mt-0.5 truncate text-sm text-white/75">
                <span className="font-semibold text-white">{plate}</span>
                {tripTitle ? ` · ${tripTitle}` : ''}
                {vehicle.trip_id ? ` · #${vehicle.trip_id}` : ''}
                {liveSpeed != null ? ` · ${liveSpeed} km/h` : ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/70 font-mono">
                {Number.isFinite(Number(vehicle.lat)) ? (
                  <span>
                    Τώρα {Number(vehicle.lat).toFixed(5)}, {Number(vehicle.lng).toFixed(5)}
                  </span>
                ) : null}
                {heading != null ? <span>κατεύθυνση {heading}°</span> : null}
                {vehicle.imei ? <span>IMEI …{String(vehicle.imei).slice(-6)}</span> : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition"
              aria-label="Κλείσιμο"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>
        </header>

        <div className="flex flex-wrap gap-1.5 px-4 pt-3">
          {TABS.map((t) => {
            const count =
              t.id === 'sessions'
                ? sessions.length
                : t.id === 'points'
                  ? data?.pointCount || 0
                  : t.id === 'boarding'
                    ? data?.boarding?.boarded_count ?? 0
                    : null;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  tab === t.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-black/[0.06] hover:border-slate-300'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{t.icon}</span>
                {t.label}
                {count != null && count > 0 ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                      tab === t.id ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {loading ? (
            <div className="py-14 text-center">
              <span className="material-symbols-outlined animate-spin text-3xl text-slate-400">
                progress_activity
              </span>
              <p className="mt-2 text-sm text-slate-500">Φόρτωση ιστορικού…</p>
            </div>
          ) : null}
          {error ? (
            <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </p>
          ) : null}

          {data ? (
            <>
              <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <StatCard
                  label="Έναρξη"
                  value={formatClock(data.trackingStartedAt || data.fromTime)}
                  icon="schedule"
                />
                <StatCard label="Χιλιόμετρα" value={formatKm(data.km)} icon="straighten" />
                <StatCard
                  label="Διάρκεια"
                  value={formatDuration(data.durationMin)}
                  icon="timelapse"
                />
                <StatCard label="Στίγματα" value={String(data.pointCount)} icon="radar" />
                <StatCard
                  label="Μέγ. ταχύτητα"
                  value={
                    Number.isFinite(data.maxSpeed) ? `${Math.round(data.maxSpeed)} km/h` : '—'
                  }
                  icon="speed"
                />
                <StatCard
                  label="Μέση ταχύτητα"
                  value={
                    Number.isFinite(data.avgSpeed) ? `${Math.round(data.avgSpeed)} km/h` : '—'
                  }
                  icon="trending_flat"
                />
              </section>

              {tab === 'overview' ? (
                <OverviewPanel
                  data={data}
                  vehicle={vehicle}
                  points={points}
                  sessions={sessions}
                  selectedPointIdx={selectedPointIdx}
                  onSelectPoint={setSelectedPointIdx}
                  onCopy={handleCopy}
                  copied={copied}
                  onOpenFullHistory={openFullHistory}
                  tripTitle={tripTitle}
                />
              ) : null}

              {tab === 'sessions' ? (
                <SessionsPanel sessions={sessions} onJumpToPoints={() => setTab('points')} />
              ) : null}

              {tab === 'points' ? (
                <PointsPanel
                  points={points}
                  selectedPointIdx={selectedPointIdx}
                  onSelect={setSelectedPointIdx}
                  onCopy={handleCopy}
                  copied={copied}
                />
              ) : null}

              {tab === 'boarding' ? <BoardingPanel data={data} /> : null}

              {selectedPoint && tab !== 'points' ? (
                <p className="text-xs text-slate-500 font-mono px-1">
                  Επιλεγμένο στίγμα · {formatClock(selectedPoint.recorded_at)} ·{' '}
                  {Math.round(selectedPoint.speed_kmh || 0)} km/h ·{' '}
                  {formatCoords(selectedPoint.lat, selectedPoint.lng)}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="rounded-2xl bg-white border border-black/[0.05] px-3 py-3 shadow-sm">
      <div className="flex items-center gap-1 text-slate-400">
        <span className="material-symbols-outlined text-[14px]">{icon}</span>
        <p className="text-[10px] font-bold uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-1.5 text-base sm:text-lg font-bold tabular-nums text-slate-900 leading-tight">
        {value}
      </p>
    </div>
  );
}

function OverviewPanel({
  data,
  vehicle,
  points,
  sessions,
  selectedPointIdx,
  onSelectPoint,
  onCopy,
  copied,
  onOpenFullHistory,
  tripTitle,
}) {
  const activeSession = sessions.find((s) => s.active) || sessions[sessions.length - 1] || null;
  return (
    <div className="space-y-3">
      <section className="rounded-[22px] border border-black/[0.06] bg-white px-4 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Διαδρομή σήμερα</h3>
            <p className="mt-1 text-sm text-slate-600">
              {data.pointCount
                ? `${formatClock(data.fromTime)} → ${formatClock(data.toTime)} · ${data.pointCount} στίγματα · ${sessions.length} ${sessions.length === 1 ? 'εμφάνιση' : 'εμφανίσεις'} στον χάρτη`
                : 'Δεν υπάρχουν ακόμα καταγεγραμμένα GPS σημεία για σήμερα.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <FleetDriverPlaybackButton vehicle={vehicle} />
            <button
              type="button"
              onClick={onOpenFullHistory}
              className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
            >
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              Πλήρες ιστορικό
            </button>
          </div>
        </div>

        {points.length > 1 ? (
          <div className="mt-3 h-24 overflow-hidden rounded-2xl bg-gradient-to-br from-sky-50 via-white to-amber-50 border border-black/[0.04]">
            <RouteSparkline
              points={points}
              highlightIdx={selectedPointIdx}
              onPointClick={onSelectPoint}
            />
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <InfoTile
            title="Αφετηρία GPS"
            primary={formatClock(data.fromTime)}
            secondary={formatCoords(data.startLat, data.startLng)}
            onCopy={() =>
              onCopy('start', formatCoords(data.startLat, data.startLng))
            }
            copied={copied === 'start'}
            tone="green"
          />
          <InfoTile
            title={activeSession?.active ? 'Τελευταίο στίγμα (ζωντανό)' : 'Τέλος GPS'}
            primary={formatClock(data.toTime)}
            secondary={formatCoords(data.endLat, data.endLng)}
            onCopy={() => onCopy('end', formatCoords(data.endLat, data.endLng))}
            copied={copied === 'end'}
            tone={activeSession?.active ? 'blue' : 'red'}
          />
        </div>

        <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <MetaItem label="Πηγή" value={sourceLabel(vehicle?.source || data.pointSources?.[0])} />
          <MetaItem
            label="Κινούμενο μ.ό."
            value={
              Number.isFinite(data.movingAvgSpeed)
                ? `${Math.round(data.movingAvgSpeed)} km/h`
                : '—'
            }
          />
          <MetaItem label="Εκδρομή" value={tripTitle || '—'} />
          <MetaItem
            label="IMEI"
            value={vehicle?.imei ? `…${String(vehicle.imei).slice(-8)}` : '—'}
          />
        </dl>
      </section>

      {sessions.length ? (
        <section className="rounded-[22px] border border-black/[0.06] bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-bold text-slate-900">Τελευταία είσοδος / έξοδος</h3>
            <span className="text-[11px] font-semibold text-slate-500">
              {sessions.length} σύνολο
            </span>
          </div>
          <SessionCard session={activeSession || sessions[sessions.length - 1]} featured />
        </section>
      ) : null}
    </div>
  );
}

function SessionsPanel({ sessions, onJumpToPoints }) {
  if (!sessions.length) {
    return (
      <EmptyState
        icon="login"
        title="Καμία εμφάνιση στον χάρτη"
        body="Μόλις καταγραφούν στίγματα GPS, θα φαίνεται εδώ πότε μπήκε και βγήκε το όχημα."
      />
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-slate-600">
          Κάθε συνεδρία = συνεχής παρουσία στον live χάρτη (διάστημα &gt; 20λ = νέα είσοδος).
        </p>
        <button
          type="button"
          onClick={onJumpToPoints}
          className="text-xs font-bold text-[#0040df] hover:underline shrink-0"
        >
          Όλα τα στίγματα
        </button>
      </div>
      <ul className="space-y-2">
        {sessions
          .slice()
          .reverse()
          .map((session) => (
            <li key={session.id}>
              <SessionCard session={session} />
            </li>
          ))}
      </ul>
    </div>
  );
}

function SessionCard({ session, featured = false }) {
  if (!session) return null;
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        featured
          ? 'border-[#0040df]/25 bg-gradient-to-br from-[#0040df]/[0.06] to-white'
          : 'border-black/[0.06] bg-slate-50/80'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-900 inline-flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[17px] text-[#0040df]">timeline</span>
          Συνεδρία {session.index}
        </p>
        {session.active ? (
          <span className="rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 ring-1 ring-emerald-100">
            Ενεργό στον χάρτη
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
            {formatKm(session.km)}
          </span>
        )}
      </div>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Μπήκε</p>
          <p className="font-bold tabular-nums text-slate-900">{formatClock(session.enteredAt)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {session.active ? 'Τώρα' : 'Βγήκε'}
          </p>
          <p className="font-bold tabular-nums text-slate-900">
            {session.active ? 'στον χάρτη' : formatClock(session.exitedAt)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Διάρκεια</p>
          <p className="font-bold tabular-nums text-slate-900">
            {formatDuration(session.durationMin)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Στίγματα</p>
          <p className="font-bold tabular-nums text-slate-900">{session.pointCount}</p>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate-500 font-mono truncate">
        {formatCoords(session.enterLat, session.enterLng)} →{' '}
        {formatCoords(session.exitLat, session.exitLng)}
        {Number.isFinite(session.maxSpeed)
          ? ` · μέγ. ${Math.round(session.maxSpeed)} km/h`
          : ''}
        {session.source ? ` · ${sourceLabel(session.source)}` : ''}
      </p>
    </div>
  );
}

function PointsPanel({ points, selectedPointIdx, onSelect, onCopy, copied }) {
  if (!points.length) {
    return (
      <EmptyState
        icon="my_location"
        title="Χωρίς στίγματα σήμερα"
        body="Όταν το Teltonika ή το app στείλει GPS, εμφανίζονται εδώ με ώρα και συντεταγμένες."
      />
    );
  }
  const display = points.slice().reverse();
  return (
    <div className="rounded-[22px] border border-black/[0.06] bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-black/[0.05] flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Καταγεγραμμένα στίγματα</h3>
        <span className="text-xs font-semibold text-slate-500">{points.length} σημεία</span>
      </div>
      <ul className="max-h-[min(48vh,420px)] overflow-y-auto divide-y divide-slate-100">
        {display.map((p, revIdx) => {
          const idx = points.length - 1 - revIdx;
          const selected = selectedPointIdx === idx;
          const coords = formatCoords(p.lat, p.lng);
          return (
            <li key={`${p.recorded_at}-${idx}`}>
              <button
                type="button"
                onClick={() => onSelect(idx)}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 transition ${
                  selected ? 'bg-[#0040df]/[0.07]' : 'hover:bg-slate-50'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    selected
                      ? 'bg-[#0040df] text-white'
                      : idx === 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : idx === points.length - 1
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-900 tabular-nums">
                      {formatClock(p.recorded_at)}
                      <span className="ml-2 font-semibold text-slate-500">
                        {Math.round(p.speed_kmh || 0)} km/h
                      </span>
                    </p>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      {sourceLabel(p.source)}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-500 truncate">{coords}</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
                  title="Αντιγραφή συντεταγμένων"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopy(`pt-${idx}`, coords);
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {copied === `pt-${idx}` ? 'check' : 'content_copy'}
                  </span>
                </button>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BoardingPanel({ data }) {
  const boarded = data.boarding?.boarded_count ?? 0;
  const capacity = data.boarding?.capacity;
  const hasTrip = Boolean(data.tripId);
  if (!hasTrip) {
    return (
      <EmptyState
        icon="group"
        title="Χωρίς ενεργή εκδρομή"
        body="Τα check-in επιβατών εμφανίζονται όταν το λεωφορείο είναι δεμένο σε δρομολόγιο."
      />
    );
  }
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <h3 className="text-sm font-bold text-slate-900">Check-in επιβατών ανά στάση</h3>
        <span className="text-xs font-semibold text-slate-500">
          {data.boarding?.progress_label || `${boarded}/${capacity ?? '—'}`}
        </span>
      </div>
      <ul className="space-y-3">
        {(data.checkinsByStop || []).map((stop) => (
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
  );
}

function InfoTile({ title, primary, secondary, onCopy, copied, tone }) {
  const toneClass =
    tone === 'green'
      ? 'border-emerald-100 from-emerald-50/80'
      : tone === 'red'
        ? 'border-rose-100 from-rose-50/70'
        : 'border-sky-100 from-sky-50/80';
  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br ${toneClass} to-white px-3 py-3 flex items-start justify-between gap-2`}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{title}</p>
        <p className="mt-1 text-base font-bold tabular-nums text-slate-900">{primary}</p>
        <p className="mt-0.5 font-mono text-[11px] text-slate-500 truncate">{secondary}</p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
        title="Αντιγραφή"
      >
        <span className="material-symbols-outlined text-[16px]">
          {copied ? 'check' : 'content_copy'}
        </span>
      </button>
    </div>
  );
}

function MetaItem({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-black/[0.04] px-2.5 py-2">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-xs font-semibold text-slate-800 truncate">{value}</dd>
    </div>
  );
}

function EmptyState({ icon, title, body }) {
  return (
    <div className="rounded-[22px] border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
      <span className="material-symbols-outlined text-3xl text-slate-300">{icon}</span>
      <p className="mt-2 text-sm font-bold text-slate-800">{title}</p>
      <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">{body}</p>
    </div>
  );
}

/** Interactive SVG path from GPS points (normalized). */
function RouteSparkline({ points, highlightIdx = null, onPointClick }) {
  const sample =
    points.length > 80
      ? points.filter((_, i) => i % Math.ceil(points.length / 80) === 0)
      : points;
  const lats = sample.map((p) => p.lat);
  const lngs = sample.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const w = 480;
  const h = 96;
  const pad = 10;
  const sx = (lng) => pad + ((lng - minLng) / Math.max(1e-9, maxLng - minLng)) * (w - pad * 2);
  const sy = (lat) => pad + ((maxLat - lat) / Math.max(1e-9, maxLat - minLat)) * (h - pad * 2);
  const d = sample
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.lng).toFixed(1)},${sy(p.lat).toFixed(1)}`)
    .join(' ');
  const hi =
    highlightIdx != null && points[highlightIdx]
      ? points[highlightIdx]
      : null;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="fleet-history-line" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0a84ff" />
          <stop offset="100%" stopColor="#0040df" />
        </linearGradient>
      </defs>
      <path
        d={d}
        fill="none"
        stroke="url(#fleet-history-line)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {sample.map((p, i) => {
        const realIdx = points.indexOf(p);
        return (
          <circle
            key={`dot-${i}`}
            cx={sx(p.lng)}
            cy={sy(p.lat)}
            r={i === 0 || i === sample.length - 1 ? 4.5 : 2.2}
            fill={i === 0 ? '#34c759' : i === sample.length - 1 ? '#ff3b30' : '#94a3b8'}
            className="cursor-pointer"
            onClick={() => onPointClick?.(realIdx >= 0 ? realIdx : i)}
          />
        );
      })}
      {hi ? (
        <circle
          cx={sx(hi.lng)}
          cy={sy(hi.lat)}
          r="6"
          fill="#0040df"
          stroke="#facc15"
          strokeWidth="2.5"
        />
      ) : null}
    </svg>
  );
}
