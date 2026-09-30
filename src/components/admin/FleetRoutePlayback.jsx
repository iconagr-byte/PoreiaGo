import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  fetchTripRoute,
  fetchVehicleRoute,
  downloadTripRouteExport,
} from '../../services/telemetryApi.js';
import {
  parsePlaybackFilters,
  resolvePlaybackDateRange,
  todayIsoDate,
} from '../../lib/admin/fleetPlaybackNav.js';
import { pathLengthKm, segmentGpsSessions } from '../../lib/admin/fleetVehicleHistory.js';
import { resolveVehicleTripTitle } from '../../lib/admin/fleetBusPillLabel.js';
import { useFleetTelemetryEgress } from '../../context/FleetTelemetryContext.jsx';
import { LEAFLET_BASEMAP } from '../../lib/maps/appleMapTheme.js';

function FitRoute({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (!positions?.length) return;
    map.fitBounds(positions, { padding: [40, 40] });
  }, [positions, map]);
  return null;
}

function useRoutePlayback(points, { playing, speed }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [points]);

  useEffect(() => {
    if (!playing || points.length < 2) return undefined;
    const current = points[index];
    const next = points[Math.min(index + 1, points.length - 1)];
    if (!current || !next || index >= points.length - 1) return undefined;

    const t0 = new Date(current.recorded_at).getTime();
    const t1 = new Date(next.recorded_at).getTime();
    const delta = Number.isFinite(t1 - t0) && t1 > t0 ? t1 - t0 : 1500;
    const ms = Math.max(150, Math.min(4000, delta / speed));

    const timer = setTimeout(() => setIndex((i) => Math.min(i + 1, points.length - 1)), ms);
    return () => clearTimeout(timer);
  }, [playing, index, points, speed]);

  const position = points[index] || null;
  return { index, position, setIndex };
}

function resolveDateRange(dateKey, customDate) {
  return resolvePlaybackDateRange(dateKey, customDate);
}

function liveVehicleKey(v) {
  return String(v?.vehicle_id || v?.id || v?.driver_id || v?.bus_plate || '');
}

function formatClock(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function formatDayClock(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('el-GR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatKm(km) {
  if (!Number.isFinite(km)) return '—';
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

function formatDuration(min) {
  if (!Number.isFinite(min)) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h <= 0) return `${m}λ`;
  return `${h}ώ ${String(m).padStart(2, '0')}λ`;
}

/** Ιστορικό playback — GPS sessions (είσοδος/έξοδος χάρτη) + αναπαραγωγή. */
export default function FleetRoutePlayback() {
  const location = useLocation();
  const { vehicles } = useFleetTelemetryEgress();
  const urlFilters = useMemo(
    () => parsePlaybackFilters(new URLSearchParams(location.search)),
    [location.search],
  );
  const autoLoadedRef = useRef(false);

  const [tripId, setTripId] = useState(urlFilters.tripId || '');
  const [driverId, setDriverId] = useState(urlFilters.driverId || '');
  const [vehicleId, setVehicleId] = useState('');
  const [vehicleCode, setVehicleCode] = useState('');
  const [dateFilter, setDateFilter] = useState(
    urlFilters.dateKey === 'today' || urlFilters.dateKey === '7d' || urlFilters.dateKey === 'all'
      ? urlFilters.dateKey || 'today'
      : /^\d{4}-\d{2}-\d{2}$/.test(urlFilters.dateKey)
        ? 'custom'
        : 'today',
  );
  const [customDate, setCustomDate] = useState(
    /^\d{4}-\d{2}-\d{2}$/.test(urlFilters.dateKey) && urlFilters.dateKey !== 'today'
      ? urlFilters.dateKey
      : todayIsoDate(),
  );
  const [driverLabel, setDriverLabel] = useState(urlFilters.driverName || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [route, setRoute] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(8);
  const [exporting, setExporting] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('all');
  const scrubbing = useRef(false);

  const allPoints = route?.points || [];
  const sessions = useMemo(() => segmentGpsSessions(allPoints), [allPoints]);

  const activeSession = useMemo(() => {
    if (selectedSessionId === 'all') return null;
    return sessions.find((s) => s.id === selectedSessionId) || null;
  }, [sessions, selectedSessionId]);

  const points = activeSession?.points || allPoints;
  const positions = useMemo(() => points.map((p) => [p.lat, p.lng]), [points]);
  const { index, position, setIndex } = useRoutePlayback(points, { playing, speed });

  const liveVehicles = useMemo(() => {
    return (vehicles || [])
      .filter((v) => Number.isFinite(Number(v.lat)) && Number.isFinite(Number(v.lng)))
      .map((v) => {
        const trip = resolveVehicleTripTitle(v);
        const tid = v.trip_id ?? v.tripId ?? null;
        return {
          key: liveVehicleKey(v),
          trip_id: tid != null && Number(tid) > 0 ? Number(tid) : null,
          driver_id: v.driver_id || '',
          vehicle_id: String(v.id || v.vehicle_id || ''),
          name: v.driver_name || v.bus_plate || v.vehicle_code || 'Όχημα',
          plate: v.bus_plate || v.vehicle_code || '',
          title: trip || '',
          tracking_started_at: v.tracking_started_at || null,
        };
      });
  }, [vehicles]);

  const driverOptions = useMemo(() => {
    const map = new Map();
    for (const v of liveVehicles) {
      if (!v.driver_id) continue;
      map.set(v.driver_id, {
        id: v.driver_id,
        name: v.name,
        trip_id: v.trip_id,
        plate: v.plate,
        vehicle_id: v.vehicle_id,
      });
    }
    return [...map.values()];
  }, [liveVehicles]);

  useEffect(() => {
    if (urlFilters.tripId) setTripId(urlFilters.tripId);
    if (urlFilters.driverId) setDriverId(urlFilters.driverId);
    if (urlFilters.driverName) setDriverLabel(urlFilters.driverName);
    if (urlFilters.dateKey === 'today' || urlFilters.dateKey === '7d' || urlFilters.dateKey === 'all') {
      setDateFilter(urlFilters.dateKey);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(urlFilters.dateKey)) {
      setDateFilter('custom');
      setCustomDate(urlFilters.dateKey);
    }
    autoLoadedRef.current = false;
  }, [
    urlFilters.tripId,
    urlFilters.driverId,
    urlFilters.driverName,
    urlFilters.dateKey,
    location.search,
  ]);

  useEffect(() => {
    if (urlFilters.tripId || tripId || vehicleId || vehicleCode) return;
    const first = liveVehicles[0];
    if (!first) return;
    if (first.trip_id) setTripId(String(first.trip_id));
    if (first.vehicle_id) setVehicleId(first.vehicle_id);
    if (first.plate) setVehicleCode(first.plate);
    if (first.driver_id) {
      setDriverId(first.driver_id);
      setDriverLabel(first.name);
    }
  }, [liveVehicles, tripId, vehicleId, vehicleCode, urlFilters.tripId]);

  useEffect(() => {
    setSelectedSessionId('all');
    setPlaying(false);
  }, [route]);

  const applyRouteData = useCallback((data, { emptyHint } = {}) => {
    setRoute(data);
    setSelectedSessionId('all');
    if (!data?.point_count && !data?.points?.length) {
      setError(emptyHint || 'Δεν βρέθηκαν GPS σημεία για την επιλεγμένη περίοδο.');
    }
  }, []);

  const loadRoute = useCallback(async () => {
    const tid = parseInt(tripId, 10);
    const hasTrip = Number.isFinite(tid) && tid >= 1;
    const vid = String(vehicleId || '').trim();
    const code = String(vehicleCode || '').trim();
    if (!hasTrip && !vid && !code) {
      setError('Επιλέξτε όχημα από τον live χάρτη ή εισάγετε αριθμό δρομολογίου');
      return;
    }
    const { from, to } = resolveDateRange(dateFilter, customDate);
    setLoading(true);
    setError('');
    setPlaying(false);
    try {
      const data = hasTrip
        ? await fetchTripRoute(tid, {
            from,
            to,
            driverId: driverId.trim() || undefined,
          })
        : await fetchVehicleRoute(vid || 'by-plate', {
            from,
            to,
            vehicleCode: code || undefined,
          });
      const scope =
        dateFilter === 'today'
          ? 'σήμερα'
          : dateFilter === '7d'
            ? 'τις τελευταίες 7 ημέρες'
            : dateFilter === 'custom'
              ? `την ${customDate}`
              : dateFilter !== 'all'
                ? `την ${dateFilter}`
                : 'την επιλεγμένη περίοδο';
      const liveHint =
        liveVehicles.length > 0
          ? ' Επιλέξτε ενεργό όχημα από το μενού παρακάτω.'
          : ' Βεβαιωθείτε ότι ο οδηγός έχει ανοιχτή βάρδια ή ότι το Teltonika στέλνει GPS.';
      applyRouteData(data, {
        emptyHint: `Δεν βρέθηκαν GPS σημεία ${scope}.${liveHint}`,
      });
    } catch (err) {
      setError(err.message || 'Αποτυχία φόρτωσης διαδρομής');
      setRoute(null);
    } finally {
      setLoading(false);
    }
  }, [
    tripId,
    driverId,
    vehicleId,
    vehicleCode,
    dateFilter,
    customDate,
    liveVehicles.length,
    applyRouteData,
  ]);

  const loadFromLiveVehicle = useCallback(
    (vehicle) => {
      if (!vehicle) return;
      setTripId(vehicle.trip_id ? String(vehicle.trip_id) : '');
      setDriverId(vehicle.driver_id || '');
      setDriverLabel(vehicle.name || '');
      setVehicleId(vehicle.vehicle_id || '');
      setVehicleCode(vehicle.plate || '');
      setDateFilter('today');
      autoLoadedRef.current = false;
      window.setTimeout(() => {
        const { from, to } = resolveDateRange('today', customDate);
        setLoading(true);
        setError('');
        setPlaying(false);
        const promise = vehicle.trip_id
          ? fetchTripRoute(Number(vehicle.trip_id), {
              from,
              to,
              driverId: vehicle.driver_id || undefined,
            })
          : fetchVehicleRoute(vehicle.vehicle_id || 'by-plate', {
              from,
              to,
              vehicleCode: vehicle.plate || undefined,
            });
        promise
          .then((data) => {
            applyRouteData(data, {
              emptyHint:
                'Δεν υπάρχουν ακόμα αποθηκευμένα σημεία για αυτό το όχημα — μόλις σταλεί GPS θα εμφανιστούν εδώ ως είσοδος/έξοδος.',
            });
          })
          .catch((err) => {
            setError(err.message || 'Αποτυχία φόρτωσης διαδρομής');
            setRoute(null);
          })
          .finally(() => setLoading(false));
      }, 0);
    },
    [customDate, applyRouteData],
  );

  useEffect(() => {
    if (!urlFilters.autoLoad || !urlFilters.tripId || autoLoadedRef.current) return;
    autoLoadedRef.current = true;
    loadRoute();
  }, [urlFilters.autoLoad, urlFilters.tripId, loadRoute]);

  const handleExport = async (format) => {
    const tid = parseInt(tripId, 10);
    if (!Number.isFinite(tid) || tid < 1) {
      setError('Η εξαγωγή GPX/KML απαιτεί αριθμό δρομολογίου');
      return;
    }
    const { from, to } = resolveDateRange(dateFilter, customDate);
    setExporting(format);
    try {
      await downloadTripRouteExport(tid, format, {
        from,
        to,
        driverId: driverId.trim() || undefined,
      });
    } catch (err) {
      setError(err.message || 'Αποτυχία εξαγωγής');
    } finally {
      setExporting('');
    }
  };

  const center = position ? [position.lat, position.lng] : positions[0] || [38.5, 23.0];
  const filterHint =
    dateFilter === 'today'
      ? 'σήμερα'
      : dateFilter === '7d'
        ? 'τελευταίες 7 ημέρες'
        : dateFilter === 'custom'
          ? customDate
          : dateFilter !== 'all'
            ? dateFilter
            : null;
  const liveBufferCount = points.filter((p) => p.source === 'live_buffer' || p.source === 'live_trail').length;
  const totalKm = activeSession ? activeSession.km : pathLengthKm(allPoints);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-headline-md font-bold">Ιστορικό Διαδρομής</h2>
          <p className="text-sm text-on-surface-variant">
            Στίγματα GPS · ώρα εισόδου / εξόδου από τον χάρτη · αναπαραγωγή διαδρομής
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Δρομολόγιο #</span>
            <input
              type="number"
              min={1}
              value={tripId}
              onChange={(e) => setTripId(e.target.value)}
              placeholder="από live"
              className="w-28 rounded-xl border border-gray-200 px-3 py-2 font-mono"
            />
          </label>
          <label className="text-sm">
            <span className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Οδηγός</span>
            <select
              value={driverId}
              onChange={(e) => {
                const id = e.target.value;
                setDriverId(id);
                const match = driverOptions.find((d) => d.id === id);
                setDriverLabel(match?.name || '');
                if (match?.trip_id) setTripId(String(match.trip_id));
                if (match?.vehicle_id) setVehicleId(match.vehicle_id);
                if (match?.plate) setVehicleCode(match.plate);
              }}
              className="max-w-[200px] rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold truncate"
            >
              <option value="">Όλοι οδηγοί</option>
              {driverOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.trip_id ? ` · #${d.trip_id}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Ημερομηνία</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold"
            >
              <option value="today">Σήμερα</option>
              <option value="7d">7 ημέρες</option>
              <option value="custom">Συγκεκριμένη</option>
              <option value="all">Όλες</option>
            </select>
          </label>
          {dateFilter === 'custom' ? (
            <label className="text-sm">
              <span className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Ημέρα</span>
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono"
              />
            </label>
          ) : null}
          <button
            type="button"
            onClick={loadRoute}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-60"
          >
            {loading ? 'Φόρτωση…' : 'Φόρτωση'}
          </button>
        </div>
      </div>

      {(driverLabel || filterHint || tripId) && (
        <p className="text-sm text-sky-900 bg-sky-50 border border-sky-100 rounded-xl px-4 py-3">
          {driverLabel ? (
            <>
              Οδηγός: <strong>{driverLabel}</strong>
              {filterHint || tripId ? ' · ' : ''}
            </>
          ) : null}
          {filterHint ? (
            <>
              Περίοδος: <strong>{filterHint}</strong>
            </>
          ) : null}
          {tripId ? (
            <>
              {' '}
              · Δρομολόγιο <strong>#{tripId}</strong>
            </>
          ) : vehicleCode ? (
            <>
              {' '}
              · Πινακίδα <strong>{vehicleCode}</strong>
            </>
          ) : null}
        </p>
      )}

      {liveVehicles.length > 0 ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
            Στον live χάρτη τώρα ({liveVehicles.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {liveVehicles.map((v) => {
              const active =
                (v.trip_id && String(tripId) === String(v.trip_id) && (!driverId || String(driverId) === String(v.driver_id))) ||
                (!v.trip_id &&
                  ((vehicleId && vehicleId === v.vehicle_id) ||
                    (vehicleCode && vehicleCode === v.plate)));
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => loadFromLiveVehicle(v)}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold border transition ${
                    active
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-white text-emerald-900 border-emerald-200 hover:border-emerald-400'
                  }`}
                >
                  {v.plate || v.name}
                  {v.trip_id ? ` · #${v.trip_id}` : ' · GPS'}
                  {v.title ? ` · ${v.title}` : ''}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
          Δεν υπάρχει ενεργό όχημα στον live χάρτη αυτή τη στιγμή. Μόλις ανοίξει βάρδια ή σταλεί
          Teltonika GPS, εμφανίζεται εδώ για φόρτωση ιστορικού εισόδου/εξόδου.
        </p>
      )}

      {error ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          {error}
        </p>
      ) : null}

      {allPoints.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-4">
          <aside className="rounded-[22px] border border-black/[0.07] bg-white shadow-sm overflow-hidden flex flex-col max-h-[min(72vh,640px)]">
            <div className="px-4 py-3 border-b border-black/[0.06] bg-slate-50/80">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Εμφανίσεις στον χάρτη
              </p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">
                {sessions.length} {sessions.length === 1 ? 'συνεδρία' : 'συνεδρίες'} · {allPoints.length}{' '}
                στίγματα
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedSessionId('all');
                  setPlaying(false);
                  setIndex(0);
                }}
                className={`w-full text-left rounded-2xl px-3 py-3 border transition ${
                  selectedSessionId === 'all'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-800 border-black/[0.06] hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">Όλη η διαδρομή</span>
                  <span className="text-[11px] opacity-80">{formatKm(totalKm)}</span>
                </div>
                <p className={`text-xs mt-1 ${selectedSessionId === 'all' ? 'text-white/70' : 'text-slate-500'}`}>
                  {formatDayClock(allPoints[0]?.recorded_at)} →{' '}
                  {formatDayClock(allPoints[allPoints.length - 1]?.recorded_at)}
                </p>
              </button>

              {sessions
                .slice()
                .reverse()
                .map((session) => {
                  const selected = selectedSessionId === session.id;
                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => {
                        setSelectedSessionId(session.id);
                        setPlaying(false);
                        setIndex(0);
                      }}
                      className={`w-full text-left rounded-2xl px-3 py-3 border transition ${
                        selected
                          ? 'bg-[#0040df] text-white border-[#0040df]'
                          : 'bg-white text-slate-800 border-black/[0.06] hover:border-sky-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-sm font-bold">
                          <span className="material-symbols-outlined text-[16px]">timeline</span>
                          Συνεδρία {session.index}
                        </span>
                        {session.active ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              selected ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            Ενεργό
                          </span>
                        ) : (
                          <span
                            className={`text-[11px] font-semibold tabular-nums ${
                              selected ? 'text-white/80' : 'text-slate-500'
                            }`}
                          >
                            {formatKm(session.km)}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className={selected ? 'text-white/60' : 'text-slate-400'}>Μπήκε</p>
                          <p className="font-bold tabular-nums">{formatClock(session.enteredAt)}</p>
                        </div>
                        <div>
                          <p className={selected ? 'text-white/60' : 'text-slate-400'}>
                            {session.active ? 'Τώρα' : 'Βγήκε'}
                          </p>
                          <p className="font-bold tabular-nums">
                            {session.active ? 'στον χάρτη' : formatClock(session.exitedAt)}
                          </p>
                        </div>
                      </div>
                      <p className={`mt-2 text-[11px] ${selected ? 'text-white/70' : 'text-slate-500'}`}>
                        {session.pointCount} στίγματα · {formatDuration(session.durationMin)}
                        {session.tripId ? ` · #${session.tripId}` : ''}
                        {Number.isFinite(session.avgSpeed)
                          ? ` · ~${Math.round(session.avgSpeed)} km/h`
                          : ''}
                      </p>
                      <p
                        className={`mt-1 font-mono text-[10px] truncate ${
                          selected ? 'text-white/55' : 'text-slate-400'
                        }`}
                      >
                        {Number.isFinite(session.enterLat)
                          ? `${session.enterLat.toFixed(4)}, ${session.enterLng.toFixed(4)}`
                          : '—'}
                        {' → '}
                        {Number.isFinite(session.exitLat)
                          ? `${session.exitLat.toFixed(4)}, ${session.exitLng.toFixed(4)}`
                          : '—'}
                      </p>
                    </button>
                  );
                })}
            </div>
          </aside>

          <div className="space-y-3 min-w-0">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3">
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {playing ? 'pause' : 'play_arrow'}
                </span>
                {playing ? 'Παύση' : 'Αναπαραγωγή'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setIndex(0);
                }}
                className="px-3 py-2 rounded-xl border text-sm font-bold"
              >
                Αρχή
              </button>
              <button
                type="button"
                disabled={!!exporting || !parseInt(tripId, 10)}
                onClick={() => handleExport('gpx')}
                className="px-3 py-2 rounded-xl border text-sm font-bold disabled:opacity-60"
              >
                {exporting === 'gpx' ? 'GPX…' : 'GPX'}
              </button>
              <button
                type="button"
                disabled={!!exporting || !parseInt(tripId, 10)}
                onClick={() => handleExport('kml')}
                className="px-3 py-2 rounded-xl border text-sm font-bold disabled:opacity-60"
              >
                {exporting === 'kml' ? 'KML…' : 'KML'}
              </button>
              <label className="text-sm flex items-center gap-2 ml-auto">
                <span className="text-gray-500">Ταχύτητα</span>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                />
                <span className="font-mono w-8">{speed}x</span>
              </label>
            </div>

            <input
              type="range"
              min={0}
              max={Math.max(0, points.length - 1)}
              value={index}
              onMouseDown={() => {
                scrubbing.current = true;
                setPlaying(false);
              }}
              onMouseUp={() => {
                scrubbing.current = false;
              }}
              onChange={(e) => setIndex(Number(e.target.value))}
              className="w-full"
            />

            <p className="text-xs text-gray-500 font-mono">
              Σημείο {index + 1} / {points.length}
              {liveBufferCount ? ` · ${liveBufferCount} live` : ''}
              {activeSession ? ` · συνεδρία ${activeSession.index}` : ''}
              {position ? (
                <>
                  {' '}
                  · {new Date(position.recorded_at).toLocaleString('el-GR')} ·{' '}
                  {Math.round(position.speed_kmh || 0)} km/h
                </>
              ) : null}
            </p>

            <div className="h-[min(68vh,560px)] rounded-[24px] overflow-hidden border border-black/[0.08] shadow-level-2">
              <MapContainer center={center} zoom={8} className="h-full w-full" scrollWheelZoom>
                <TileLayer
                  attribution={LEAFLET_BASEMAP.attribution}
                  url={LEAFLET_BASEMAP.url}
                  subdomains={LEAFLET_BASEMAP.subdomains}
                  maxZoom={LEAFLET_BASEMAP.maxZoom}
                />
                <FitRoute positions={positions} />
                {positions.length > 1 ? (
                  <Polyline
                    positions={positions}
                    pathOptions={{ color: '#0040df', weight: 5, opacity: 0.85 }}
                  />
                ) : null}
                {points[0] ? (
                  <CircleMarker
                    center={[points[0].lat, points[0].lng]}
                    radius={8}
                    pathOptions={{ color: '#16a34a', fillColor: '#22c55e', fillOpacity: 1, weight: 2 }}
                  >
                    <Popup>Μπήκε · {formatDayClock(points[0].recorded_at)}</Popup>
                  </CircleMarker>
                ) : null}
                {points.length > 1 ? (
                  <CircleMarker
                    center={[points[points.length - 1].lat, points[points.length - 1].lng]}
                    radius={8}
                    pathOptions={{
                      color: activeSession?.active ? '#0040df' : '#dc2626',
                      fillColor: activeSession?.active ? '#3b82f6' : '#ef4444',
                      fillOpacity: 1,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      {activeSession?.active ? 'Τώρα στον χάρτη' : 'Βγήκε'} ·{' '}
                      {formatDayClock(points[points.length - 1].recorded_at)}
                    </Popup>
                  </CircleMarker>
                ) : null}
                {position ? (
                  <CircleMarker
                    center={[position.lat, position.lng]}
                    radius={12}
                    pathOptions={{ color: '#facc15', fillColor: '#0040df', fillOpacity: 1, weight: 3 }}
                  >
                    <Popup>
                      {Math.round(position.speed_kmh || 0)} km/h
                      <br />
                      {new Date(position.recorded_at).toLocaleString('el-GR')}
                    </Popup>
                  </CircleMarker>
                ) : null}
              </MapContainer>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
