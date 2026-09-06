import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchPlannedVsActual } from '../../services/telemetryApi.js';
import { getTripById } from '../../lib/trips/tripStore.js';

const PLANNED = { color: '#16a34a', label: 'Προγραμματισμένη' };
const ACTUAL = { color: '#0040df', label: 'Πραγματική GPS' };

function FitBounds({ planned, actual }) {
  const map = useMap();
  useEffect(() => {
    const all = [...(planned || []), ...(actual || [])];
    if (!all.length) return;
    map.fitBounds(L.latLngBounds(all), { padding: [48, 48] });
  }, [planned, actual, map]);
  return null;
}

function complianceTone(pct) {
  if (pct >= 90) return 'text-green-700 bg-green-50 border-green-100';
  if (pct >= 70) return 'text-amber-800 bg-amber-50 border-amber-100';
  return 'text-red-800 bg-red-50 border-red-100';
}

/** Σύγκριση προγραμματισμένης διαδρομής (corridor / στάσεις) με πραγματική GPS. */
export default function FleetRoutePlannedVsActual() {
  const [tripId, setTripId] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const plannedPoints = data?.planned?.points || [];
  const actualPoints = data?.actual?.points || [];
  const positionsPlanned = useMemo(() => plannedPoints.map((p) => [p.lat, p.lng]), [plannedPoints]);
  const positionsActual = useMemo(() => actualPoints.map((p) => [p.lat, p.lng]), [actualPoints]);
  const center = positionsPlanned[0] || positionsActual[0] || [38.5, 23.0];
  const metrics = data?.metrics;
  const summary = data?.actual?.summary;

  const loadCompare = async () => {
    const tid = parseInt(tripId, 10);
    if (!Number.isFinite(tid) || tid < 1) {
      setError('Εισάγετε έγκυρο αριθμό δρομολογίου');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const trip = getTripById(tid);
      const stops = trip?.stops?.filter((s) => s.lat != null && s.lng != null) || [];
      const result = await fetchPlannedVsActual(tid, {
        plannedStops: stops.length >= 2 ? stops : undefined,
      });
      setData(result);
      if (result.error === 'missing_planned') {
        setError('Δεν βρέθηκε προγραμματισμένη διαδρομή — προσθέστε στάσεις στο δρομολόγιο ή corridor στο backend.');
      } else if (result.error === 'missing_actual') {
        setError('Δεν βρέθηκαν GPS σημεία — ο οδηγός πρέπει να ήταν online κατά τη βάρδια.');
      } else if (result.error) {
        setError('Το ιστορικό GPS δεν είναι ακόμα διαθέσιμο — δοκιμάστε ξανά σε λίγο.');
      }
    } catch (err) {
      setError(err.message || 'Αποτυχία σύγκρισης');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const sourceLabel =
    data?.planned?.source === 'trip_stops'
      ? 'στάσεις δρομολογίου'
      : data?.planned?.source === 'corridor_geofence'
        ? 'corridor geofence'
        : '—';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-headline-md font-bold">Προγραμματισμένη vs Πραγματική</h2>
          <p className="text-sm text-on-surface-variant">
            Πράσινη διακεκομμένη = planned · Μπλε = πραγματική GPS από <code className="text-xs bg-gray-100 px-1 rounded">trip_coordinates</code>
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
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
          <button
            type="button"
            onClick={loadCompare}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-60"
          >
            {loading ? 'Φόρτωση…' : 'Σύγκριση'}
          </button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">{error}</p>
      ) : null}

      {metrics && (plannedPoints.length > 1 || actualPoints.length > 1) ? (
        <>
          <div className="flex flex-wrap gap-3 text-xs font-bold">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-50 text-green-800">
              <span className="w-3 h-3 rounded-full border-2 border-[#16a34a] border-dashed" /> {PLANNED.label} ({sourceLabel})
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-800">
              <span className="w-3 h-3 rounded-full bg-[#0040df]" /> {ACTUAL.label} · {actualPoints.length} σημεία
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className={`rounded-2xl border p-4 ${complianceTone(metrics.on_corridor_pct)}`}>
              <dt className="text-[10px] uppercase font-bold opacity-70">Συμμόρφωση corridor</dt>
              <dd className="mt-2 text-3xl font-black">{metrics.compliance_score}%</dd>
              <p className="text-xs mt-1 opacity-80">εντός {metrics.buffer_m} m buffer</p>
            </div>
            <div className="rounded-2xl border border-black/[0.06] bg-white p-4">
              <dt className="text-[10px] uppercase font-bold text-gray-400">Μέση απόκλιση</dt>
              <dd className="mt-2 text-2xl font-black text-gray-900">{metrics.mean_deviation_m} m</dd>
              <p className="text-xs text-gray-500 mt-1">max: {metrics.max_deviation_m} m</p>
            </div>
            <div className="rounded-2xl border border-black/[0.06] bg-white p-4">
              <dt className="text-[10px] uppercase font-bold text-gray-400">Εκτός corridor</dt>
              <dd className="mt-2 text-2xl font-black text-gray-900">{metrics.off_corridor_points}</dd>
              <p className="text-xs text-gray-500 mt-1">GPS σημεία εκτός buffer</p>
            </div>
            {summary ? (
              <div className="rounded-2xl border border-black/[0.06] bg-white p-4">
                <dt className="text-[10px] uppercase font-bold text-gray-400">Πραγματική διαδρομή</dt>
                <dd className="mt-2 text-sm font-bold text-gray-900">
                  {summary.path_length_km} km · {summary.duration_min} λεπτά
                </dd>
                <p className="text-xs text-gray-500 mt-1">μέση ταχύτητα {summary.avg_speed_kmh} km/h</p>
              </div>
            ) : null}
          </div>

          <div className="h-[min(60vh,520px)] rounded-[24px] overflow-hidden border border-black/[0.08] shadow-level-2">
            <MapContainer center={center} zoom={8} className="h-full w-full" scrollWheelZoom>
              <TileLayer
                attribution="© OpenStreetMap · © CARTO"
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />
              <FitBounds planned={positionsPlanned} actual={positionsActual} />
              {positionsPlanned.length > 1 ? (
                <Polyline
                  positions={positionsPlanned}
                  pathOptions={{ color: PLANNED.color, weight: 5, opacity: 0.85, dashArray: '10 8' }}
                />
              ) : null}
              {positionsActual.length > 1 ? (
                <Polyline positions={positionsActual} pathOptions={{ color: ACTUAL.color, weight: 5, opacity: 0.9 }} />
              ) : null}
            </MapContainer>
          </div>
        </>
      ) : null}
    </div>
  );
}
