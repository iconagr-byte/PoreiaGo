import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchTripRoute, downloadTripRouteExport } from '../../services/telemetryApi.js';
import {
  parsePlaybackFilters,
  resolvePlaybackDateRange,
  todayIsoDate,
} from '../../lib/admin/fleetPlaybackNav.js';
import { useFleetTelemetryEgress } from '../../context/FleetTelemetryContext.jsx';

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

/** Ιστορικό playback — GPS από εφαρμογή οδηγού (live ingest → buffer + PostGIS). */
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
  const scrubbing = useRef(false);

  const points = route?.points || [];
  const positions = useMemo(() => points.map((p) => [p.lat, p.lng]), [points]);
  const { index, position, setIndex } = useRoutePlayback(points, { playing, speed });

  const liveVehicles = useMemo(() => {
    return (vehicles || [])
      .filter((v) => Number.isFinite(Number(v.lat)) && Number.isFinite(Number(v.lng)))
      .map((v) => ({
        key: liveVehicleKey(v),
        trip_id: v.trip_id ?? v.tripId ?? null,
        driver_id: v.driver_id || '',
        name: v.driver_name || v.bus_plate || v.vehicle_code || 'Όχημα',
        plate: v.bus_plate || v.vehicle_code || '',
        title: v.trip_title || '',
      }))
      .filter((v) => v.trip_id != null && Number(v.trip_id) > 0);
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

  // Prefer a live trip when the form still has the legacy default empty/#1.
  useEffect(() => {
    if (urlFilters.tripId || tripId) return;
    const first = liveVehicles[0];
    if (!first) return;
    setTripId(String(first.trip_id));
    if (first.driver_id) {
      setDriverId(first.driver_id);
      setDriverLabel(first.name);
    }
  }, [liveVehicles, tripId, urlFilters.tripId]);

  const loadRoute = useCallback(async () => {
    const tid = parseInt(tripId, 10);
    if (!Number.isFinite(tid) || tid < 1) {
      setError('Επιλέξτε δρομολόγιο από τον live χάρτη ή εισάγετε αριθμό δρομολογίου');
      return;
    }
    const { from, to } = resolveDateRange(dateFilter, customDate);
    setLoading(true);
    setError('');
    setPlaying(false);
    try {
      const data = await fetchTripRoute(tid, {
        from,
        to,
        driverId: driverId.trim() || undefined,
      });
      setRoute(data);
      if (!data.point_count) {
        const liveHint =
          liveVehicles.length > 0
            ? ' Επιλέξτε ενεργό όχημα από τον live χάρτη παρακάτω.'
            : ' Βεβαιωθείτε ότι ο οδηγός έχει ανοιχτή βάρδια και στέλνει GPS.';
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
        setError(`Δεν βρέθηκαν GPS σημεία ${scope}.${liveHint}`);
      }
    } catch (err) {
      setError(err.message || 'Αποτυχία φόρτωσης διαδρομής');
      setRoute(null);
    } finally {
      setLoading(false);
    }
  }, [tripId, driverId, dateFilter, customDate, liveVehicles.length]);

  const loadFromLiveVehicle = useCallback(
    (vehicle) => {
      if (!vehicle?.trip_id) return;
      setTripId(String(vehicle.trip_id));
      setDriverId(vehicle.driver_id || '');
      setDriverLabel(vehicle.name || '');
      setDateFilter('today');
      autoLoadedRef.current = false;
      // load after state settles via effect below
      window.setTimeout(() => {
        const tid = Number(vehicle.trip_id);
        const { from, to } = resolveDateRange('today', customDate);
        setLoading(true);
        setError('');
        setPlaying(false);
        fetchTripRoute(tid, {
          from,
          to,
          driverId: vehicle.driver_id || undefined,
        })
          .then((data) => {
            setRoute(data);
            if (!data.point_count) {
              setError(
                'Δεν υπάρχουν ακόμα αποθηκευμένα σημεία για αυτό το όχημα — μόλις ο οδηγός στείλει GPS θα εμφανιστούν εδώ.',
              );
            }
          })
          .catch((err) => {
            setError(err.message || 'Αποτυχία φόρτωσης διαδρομής');
            setRoute(null);
          })
          .finally(() => setLoading(false));
      }, 0);
    },
    [customDate],
  );

  useEffect(() => {
    if (!urlFilters.autoLoad || !urlFilters.tripId || autoLoadedRef.current) return;
    autoLoadedRef.current = true;
    loadRoute();
  }, [urlFilters.autoLoad, urlFilters.tripId, loadRoute]);

  const handleExport = async (format) => {
    const tid = parseInt(tripId, 10);
    if (!Number.isFinite(tid) || tid < 1) return;
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
  const liveBufferCount = points.filter((p) => p.source === 'live_buffer').length;

  return (
    <div className="space-y-4">
      {driverLabel || filterHint ? (
        <p className="text-sm text-sky-900 bg-sky-50 border border-sky-100 rounded-xl px-4 py-3">
          {driverLabel ? (
            <>
              Οδηγός: <strong>{driverLabel}</strong>
              {filterHint ? ' · ' : ''}
            </>
          ) : null}
          {filterHint ? (
            <>
              Φίλτρο ημερομηνίας: <strong>{filterHint}</strong>
            </>
          ) : null}
          {tripId ? (
            <>
              {' '}
              · Δρομολόγιο <strong>#{tripId}</strong>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-headline-md font-bold">Ιστορικό Διαδρομής</h2>
          <p className="text-sm text-on-surface-variant">
            GPS από την εφαρμογή οδηγού (live χάρτης → αποθήκευση διαδρομής)
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
              }}
              className="max-w-[200px] rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold truncate"
            >
              <option value="">Όλοι οδηγοί</option>
              {driverOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · #{d.trip_id}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Οδηγός ID</span>
            <input
              type="text"
              value={driverId}
              onChange={(e) => {
                setDriverId(e.target.value);
                setDriverLabel('');
              }}
              placeholder="ή χειροκίνητα"
              className="w-36 rounded-xl border border-gray-200 px-3 py-2 font-mono text-xs"
            />
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

      {liveVehicles.length > 0 ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
            Ενεργά από live χάρτη ({liveVehicles.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {liveVehicles.map((v) => {
              const active =
                String(tripId) === String(v.trip_id) &&
                (!driverId || String(driverId) === String(v.driver_id));
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
                  {v.plate || v.name} · #{v.trip_id}
                  {v.title ? ` · ${v.title}` : ''}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
          Δεν υπάρχει ενεργό όχημα στον live χάρτη αυτή τη στιγμή. Μόλις ο οδηγός ανοίξει βάρδια και
          στείλει GPS, εμφανίζεται εδώ για φόρτωση διαδρομής.
        </p>
      )}

      {error ? <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">{error}</p> : null}

      {points.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold"
            >
              <span className="material-symbols-outlined text-[18px]">{playing ? 'pause' : 'play_arrow'}</span>
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
              disabled={!!exporting}
              onClick={() => handleExport('gpx')}
              className="px-3 py-2 rounded-xl border text-sm font-bold disabled:opacity-60"
            >
              {exporting === 'gpx' ? 'GPX…' : 'GPX'}
            </button>
            <button
              type="button"
              disabled={!!exporting}
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
            {position ? (
              <>
                {' '}
                · {new Date(position.recorded_at).toLocaleString('el-GR')} · {Math.round(position.speed_kmh)} km/h
              </>
            ) : null}
          </p>

          <div className="h-[min(68vh,560px)] rounded-[24px] overflow-hidden border border-black/[0.08] shadow-level-2">
            <MapContainer center={center} zoom={8} className="h-full w-full" scrollWheelZoom>
              <TileLayer
                attribution="© OpenStreetMap · © CARTO"
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />
              <FitRoute positions={positions} />
              {positions.length > 1 ? (
                <Polyline positions={positions} pathOptions={{ color: '#0040df', weight: 5, opacity: 0.85 }} />
              ) : null}
              {position ? (
                <CircleMarker
                  center={[position.lat, position.lng]}
                  radius={12}
                  pathOptions={{ color: '#facc15', fillColor: '#0040df', fillOpacity: 1, weight: 3 }}
                >
                  <Popup>
                    {Math.round(position.speed_kmh)} km/h
                    <br />
                    {new Date(position.recorded_at).toLocaleString('el-GR')}
                  </Popup>
                </CircleMarker>
              ) : null}
            </MapContainer>
          </div>
        </>
      ) : null}
    </div>
  );
}
