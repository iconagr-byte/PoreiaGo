import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../../styles/fleet-live-map.css';
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

function playbackBusIcon(point) {
  const heading = Number.isFinite(point?.heading) ? point.heading : 0;
  const speed = Math.round(point?.speed_kmh || 0);
  return L.divIcon({
    className: 'fleet-bus-marker-ws',
    html: `<div class="fleet-apple-bus-pin">
      <div class="fleet-apple-bus-pin__ring">
        <div class="fleet-apple-bus-pin__avatar" style="display:flex;align-items:center;justify-content:center;background:#0040df;font-size:22px;border-color:#fff;box-shadow:0 0 0 3px rgba(250,204,21,.55)">🚌</div>
        <div class="fleet-apple-bus-pin__heading" style="transform:translateX(-50%) rotate(${heading}deg);border-bottom-color:#facc15"></div>
      </div>
      <div class="fleet-apple-bus-pill">${speed} km/h</div>
    </div>`,
    iconSize: [52, 72],
    iconAnchor: [26, 26],
  });
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

/** Ιστορικό playback διαδρομής από PostGIS trip_coordinates. */
export default function FleetRoutePlayback() {
  const location = useLocation();
  const { vehicles } = useFleetTelemetryEgress();
  const urlFilters = useMemo(
    () => parsePlaybackFilters(new URLSearchParams(location.search)),
    [location.search],
  );
  const autoLoadedRef = useRef(false);

  const [tripId, setTripId] = useState(urlFilters.tripId || '1');
  const [driverId, setDriverId] = useState(urlFilters.driverId || '');
  const [dateFilter, setDateFilter] = useState(
    urlFilters.dateKey === 'today' || urlFilters.dateKey === '7d' || urlFilters.dateKey === 'all'
      ? urlFilters.dateKey || 'all'
      : /^\d{4}-\d{2}-\d{2}$/.test(urlFilters.dateKey)
        ? 'custom'
        : 'all',
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

  const driverOptions = useMemo(() => {
    const map = new Map();
    for (const v of vehicles) {
      if (!v.driver_id) continue;
      map.set(v.driver_id, {
        id: v.driver_id,
        name: v.driver_name || v.driver_id,
        trip_id: v.trip_id,
        plate: v.bus_plate,
      });
    }
    return [...map.values()];
  }, [vehicles]);

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

  const loadRoute = useCallback(async () => {
    const tid = parseInt(tripId, 10);
    if (!Number.isFinite(tid) || tid < 1) {
      setError('Εισάγετε έγκυρο αριθμό δρομολογίου');
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
        setError(`Δεν βρέθηκαν GPS σημεία ${scope} — ο οδηγός πρέπει να ήταν online.`);
      }
    } catch (err) {
      setError(err.message || 'Αποτυχία φόρτωσης διαδρομής');
      setRoute(null);
    } finally {
      setLoading(false);
    }
  }, [tripId, driverId, dateFilter, customDate]);

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
            Playback από <code className="text-xs bg-gray-100 px-1 rounded">trip_coordinates</code> (PostGIS)
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
              <option value="all">Όλες</option>
              <option value="today">Σήμερα</option>
              <option value="7d">7 ημέρες</option>
              <option value="custom">Συγκεκριμένη</option>
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
                <Marker
                  position={[position.lat, position.lng]}
                  icon={playbackBusIcon(position)}
                >
                  <Popup>
                    {Math.round(position.speed_kmh)} km/h
                    <br />
                    {new Date(position.recorded_at).toLocaleString('el-GR')}
                  </Popup>
                </Marker>
              ) : null}
            </MapContainer>
          </div>
        </>
      ) : null}
    </div>
  );
}
