import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import DashboardKpiCard from './DashboardKpiCard.jsx';
import { fetchFleetKpis } from '../../services/telemetryApi.js';

function formatDay(day) {
  try {
    return new Date(day).toLocaleDateString('el-GR', { day: '2-digit', month: 'short' });
  } catch {
    return day;
  }
}

/** Fleet KPIs — χιλιόμετρα, GPS, alerts από trip_coordinates. */
export default function FleetKpisDashboard() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchFleetKpis({ days })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Αποτυχία φόρτωσης δεικτών στόλου');
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const summary = data?.summary;
  const chartData = useMemo(
    () =>
      (data?.daily || []).map((row) => ({
        ...row,
        label: formatDay(row.day),
      })),
    [data],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-headline-md font-bold">Δείκτες στόλου</h2>
          <p className="text-sm text-on-surface-variant">
            Απόδοση στόλου με βάση πραγματικά GPS traces και ζωντανή θέση οχημάτων.
          </p>
        </div>
        <label className="text-sm">
          <span className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Περίοδος</span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-xl border border-gray-200 px-3 py-2 font-bold"
          >
            <option value={7}>7 ημέρες</option>
            <option value={30}>30 ημέρες</option>
            <option value={90}>90 ημέρες</option>
          </select>
        </label>
      </div>

      {error ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">{error}</p>
      ) : null}
      {data?.error === 'database_unavailable' ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          Η βάση GPS δεν είναι διαθέσιμη — εμφανίζονται μόνο live/alert metrics. Τρέξτε{' '}
          <code className="font-mono text-xs">alembic upgrade head</code>.
        </p>
      ) : null}

      {loading && !summary ? (
        <p className="text-sm text-gray-500">Φόρτωση δεικτών στόλου…</p>
      ) : null}

      {summary ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <DashboardKpiCard
              label="Ενεργοί τώρα"
              value={summary.active_drivers_now}
              icon="directions_bus"
              tone="emerald"
            />
            <DashboardKpiCard
              label="Συνολικά km"
              value={`${summary.total_distance_km} km`}
              icon="straighten"
              tone="sky"
            />
            <DashboardKpiCard
              label="Μέση ταχύτητα"
              value={`${summary.avg_speed_kmh} km/h`}
              icon="speed"
              tone="violet"
            />
            <DashboardKpiCard
              label="Δρομολόγια με GPS"
              value={summary.trips_tracked}
              icon="route"
              tone="amber"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <DashboardKpiCard
              label="GPS σημεία"
              value={summary.gps_points.toLocaleString('el-GR')}
              icon="pin_drop"
              tone="sky"
            />
            <DashboardKpiCard
              label="Οδηγοί με GPS"
              value={summary.drivers_with_gps}
              icon="groups"
              tone="emerald"
            />
            <DashboardKpiCard
              label="Αργή κίνηση / στάσεις"
              value={`${summary.slow_motion_pct}%`}
              icon="pause_circle"
              tone="amber"
            />
            <DashboardKpiCard
              label="Ειδοποιήσεις περιόδου"
              value={summary.alerts_total}
              icon="notifications"
              tone="violet"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 rounded-[28px] border border-black/[0.06] bg-white p-6">
              <h3 className="font-bold mb-4">Ημερήσια δραστηριότητα GPS</h3>
              {chartData.length ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="gps_points" name="GPS σημεία" fill="#0040df" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="drivers" name="Οδηγοί" fill="#16a34a" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Δεν υπάρχουν GPS δεδομένα για την περίοδο.</p>
              )}
            </div>

            <div className="rounded-[28px] border border-black/[0.06] bg-white p-6">
              <h3 className="font-bold mb-4">Ειδοποιήσεις ανά τύπο</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Απόκλιση διαδρομής</dt>
                  <dd className="font-bold">{summary.alerts_route_deviation}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Οδηγός online</dt>
                  <dd className="font-bold text-emerald-700">{summary.alerts_driver_online}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Οδηγός offline</dt>
                  <dd className="font-bold text-amber-800">{summary.alerts_driver_offline}</dd>
                </div>
                {Object.entries(data.alerts_by_type || {})
                  .filter(
                    ([k]) => !['ROUTE_DEVIATION', 'DRIVER_ONLINE', 'DRIVER_OFFLINE'].includes(k),
                  )
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <dt className="text-gray-500 font-mono text-xs">{k}</dt>
                      <dd className="font-bold">{v}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          </div>

          <div className="rounded-[28px] border border-black/[0.06] bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-black/[0.04]">
              <h3 className="font-bold">Top δρομολόγια (km)</h3>
            </div>
            {data.top_trips?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-bold">
                    <tr>
                      <th className="text-left px-6 py-3">Δρομολόγιο</th>
                      <th className="text-right px-6 py-3">km</th>
                      <th className="text-right px-6 py-3">Σημεία</th>
                      <th className="text-right px-6 py-3">Από</th>
                      <th className="text-right px-6 py-3">Έως</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_trips.map((trip) => (
                      <tr key={trip.trip_id} className="border-t border-black/[0.04]">
                        <td className="px-6 py-3 font-mono font-bold">#{trip.trip_id}</td>
                        <td className="px-6 py-3 text-right font-bold">{trip.distance_km}</td>
                        <td className="px-6 py-3 text-right">{trip.point_count}</td>
                        <td className="px-6 py-3 text-right text-xs text-gray-500">
                          {trip.first_at ? new Date(trip.first_at).toLocaleString('el-GR') : '—'}
                        </td>
                        <td className="px-6 py-3 text-right text-xs text-gray-500">
                          {trip.last_at ? new Date(trip.last_at).toLocaleString('el-GR') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-6 py-8 text-sm text-gray-500">Κανένα δρομολόγιο με GPS στην περίοδο.</p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
