import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { compareTripRoutes } from '../../services/telemetryApi.js';

const ROUTE_A = { color: '#0040df', label: 'Δρομολόγιο A' };
const ROUTE_B = { color: '#dc2626', label: 'Δρομολόγιο B' };

function FitBounds({ positionsA, positionsB }) {
  const map = useMap();
  useEffect(() => {
    const all = [...(positionsA || []), ...(positionsB || [])];
    if (!all.length) return;
    map.fitBounds(L.latLngBounds(all), { padding: [48, 48] });
  }, [positionsA, positionsB, map]);
  return null;
}

function MetricCard({ label, valueA, valueB, delta, unit = '' }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4">
      <dt className="text-[10px] uppercase font-bold text-gray-400">{label}</dt>
      <dd className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-[#0040df] font-bold">A</span> {valueA}
          {unit}
        </div>
        <div>
          <span className="text-[#dc2626] font-bold">B</span> {valueB}
          {unit}
        </div>
      </dd>
      {delta != null ? (
        <p className="text-xs text-gray-500 mt-2">
          Διαφορά (A−B): <strong className="text-gray-800">{delta}</strong>
          {unit}
        </p>
      ) : null}
    </div>
  );
}

/** Σύγκριση δύο ιστορικών διαδρομών στον ίδιο χάρτη. */
export default function FleetRouteCompare() {
  const [tripA, setTripA] = useState('1');
  const [tripB, setTripB] = useState('2');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const pointsA = data?.route_a?.points || [];
  const pointsB = data?.route_b?.points || [];
  const positionsA = useMemo(() => pointsA.map((p) => [p.lat, p.lng]), [pointsA]);
  const positionsB = useMemo(() => pointsB.map((p) => [p.lat, p.lng]), [pointsB]);
  const center = positionsA[0] || positionsB[0] || [38.5, 23.0];

  const loadCompare = async () => {
    const a = parseInt(tripA, 10);
    const b = parseInt(tripB, 10);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 1 || b < 1) {
      setError('Εισάγετε έγκυρους αριθμούς δρομολογίων');
      return;
    }
    if (a === b) {
      setError('Επιλέξτε δύο διαφορετικά δρομολόγια');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await compareTripRoutes(a, b);
      setData(result);
      if (result.error === 'missing_points') {
        setError('Λείπουν GPS σημεία σε ένα ή και τα δύο δρομολόγια.');
      } else if (result.error) {
        setError('Η βάση δεδομένων δεν είναι διαθέσιμη ή λείπει το migration trip_coordinates.');
      }
    } catch (err) {
      setError(err.message || 'Αποτυχία σύγκρισης');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const m = data?.metrics;
  const sa = data?.route_a?.summary;
  const sb = data?.route_b?.summary;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-headline-md font-bold">Σύγκριση Διαδρομών</h2>
          <p className="text-sm text-on-surface-variant">Δύο δρομολόγια στον ίδιο χάρτη — μήκος, χρόνος, απόκλιση</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-[10px] uppercase font-bold text-[#0040df] mb-1">A</span>
            <input
              type="number"
              min={1}
              value={tripA}
              onChange={(e) => setTripA(e.target.value)}
              className="w-24 rounded-xl border border-gray-200 px-3 py-2 font-mono"
            />
          </label>
          <label className="text-sm">
            <span className="block text-[10px] uppercase font-bold text-[#dc2626] mb-1">B</span>
            <input
              type="number"
              min={1}
              value={tripB}
              onChange={(e) => setTripB(e.target.value)}
              className="w-24 rounded-xl border border-gray-200 px-3 py-2 font-mono"
            />
          </label>
          <button
            type="button"
            onClick={loadCompare}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-60"
          >
            {loading ? 'Σύγκριση…' : 'Σύγκριση'}
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">{error}</p> : null}

      {m && sa && sb ? (
        <>
          <div className="flex flex-wrap gap-3 text-xs font-bold">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-800">
              <span className="w-3 h-3 rounded-full bg-[#0040df]" /> {ROUTE_A.label} #{data.trip_a}
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 text-red-800">
              <span className="w-3 h-3 rounded-full bg-[#dc2626]" /> {ROUTE_B.label} #{data.trip_b}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <MetricCard
              label="Μήκος διαδρομής"
              valueA={sa.path_length_km}
              valueB={sb.path_length_km}
              delta={m.path_length_delta_km}
              unit=" km"
            />
            <MetricCard
              label="Διάρκεια"
              valueA={sa.duration_min}
              valueB={sb.duration_min}
              delta={m.duration_delta_min}
              unit=" λεπτά"
            />
            <MetricCard
              label="Μέση ταχύτητα"
              valueA={sa.avg_speed_kmh}
              valueB={sb.avg_speed_kmh}
              delta={m.avg_speed_delta_kmh}
              unit=" km/h"
            />
            <div className="rounded-2xl border border-black/[0.06] bg-white p-4">
              <dt className="text-[10px] uppercase font-bold text-gray-400">Μέση απόκλιση (A↔B)</dt>
              <dd className="mt-2 text-2xl font-black text-gray-900">{m.symmetric_mean_deviation_m} m</dd>
              <p className="text-xs text-gray-500 mt-1">
                max A→B: {m.a_to_b_max_deviation_m} m · max B→A: {m.b_to_a_max_deviation_m} m
              </p>
            </div>
          </div>

          <div className="h-[min(60vh,520px)] rounded-[24px] overflow-hidden border border-black/[0.08] shadow-level-2">
            <MapContainer center={center} zoom={8} className="h-full w-full" scrollWheelZoom>
              <TileLayer
                attribution="© OpenStreetMap · © CARTO"
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />
              <FitBounds positionsA={positionsA} positionsB={positionsB} />
              {positionsA.length > 1 ? (
                <Polyline positions={positionsA} pathOptions={{ color: ROUTE_A.color, weight: 5, opacity: 0.9 }} />
              ) : null}
              {positionsB.length > 1 ? (
                <Polyline positions={positionsB} pathOptions={{ color: ROUTE_B.color, weight: 5, opacity: 0.85, dashArray: '8 6' }} />
              ) : null}
            </MapContainer>
          </div>
        </>
      ) : null}
    </div>
  );
}
