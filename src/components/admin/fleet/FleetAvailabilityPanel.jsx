import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { fetchFleetAvailabilityBoard } from '../../../services/platformApi.js';

export default function FleetAvailabilityPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all | available | blocked

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchFleetAvailabilityBoard();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία διαθεσιμότητας');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const available = rows.filter((r) => r.available).length;
  const blocked = rows.length - available;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'available' && !r.available) return false;
      if (filter === 'blocked' && r.available) return false;
      if (!q) return true;
      const hay = `${r.name || ''} ${r.plate || ''} ${r.reason || ''} ${r.warning || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, filter]);

  return (
    <div className="space-y-5 pb-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Διαθεσιμότητα στόλου</h2>
          <p className="text-sm text-gray-500 mt-1">
            Ποια οχήματα δέχονται νέες κρατήσεις (service / ΚΤΕΟ / ασφάλεια).
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 self-start px-3 py-2 rounded-xl border text-sm font-bold bg-white hover:bg-slate-50 disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>
            refresh
          </span>
          Ανανέωση
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl">
        <button
          type="button"
          onClick={() => setFilter('available')}
          className={`rounded-2xl border p-4 text-left transition ${
            filter === 'available' ? 'ring-2 ring-emerald-300 bg-emerald-50/80 border-emerald-200' : 'bg-white hover:border-emerald-100'
          }`}
        >
          <div className="text-[10px] font-bold text-gray-500 uppercase">Διαθέσιμα</div>
          <div className="text-3xl font-bold text-emerald-600">{available}</div>
        </button>
        <button
          type="button"
          onClick={() => setFilter('blocked')}
          className={`rounded-2xl border p-4 text-left transition ${
            filter === 'blocked' ? 'ring-2 ring-rose-300 bg-rose-50/80 border-rose-200' : 'bg-white hover:border-rose-100'
          }`}
        >
          <div className="text-[10px] font-bold text-gray-500 uppercase">Μπλοκαρισμένα</div>
          <div className="text-3xl font-bold text-rose-600">{blocked}</div>
        </button>
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`rounded-2xl border p-4 text-left transition hidden sm:block ${
            filter === 'all' ? 'ring-2 ring-slate-300 bg-slate-50/80' : 'bg-white'
          }`}
        >
          <div className="text-[10px] font-bold text-gray-500 uppercase">Σύνολο</div>
          <div className="text-3xl font-bold text-slate-800">{rows.length}</div>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <label className="flex-1 relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[20px]">
            search
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Αναζήτηση πινακίδας ή οχήματος…"
            className="w-full rounded-xl border border-black/[0.08] pl-10 pr-3 py-2.5 text-sm"
          />
        </label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-xl border border-black/[0.08] px-3 py-2.5 text-sm font-bold bg-white sm:w-44"
        >
          <option value="all">Όλα</option>
          <option value="available">Μόνο διαθέσιμα</option>
          <option value="blocked">Μόνο μπλοκαρισμένα</option>
        </select>
      </div>

      {loading && !rows.length ? (
        <p className="text-sm text-gray-500 px-1">Φόρτωση…</p>
      ) : null}

      <div className="bg-white rounded-[28px] border border-black/[0.06] overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-gray-100">
          <thead>
            <tr>
              <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Όχημα</th>
              <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Κατάσταση</th>
              <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Λόγος</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((r) => (
              <tr key={r.vehicle_id || r.plate} className="hover:bg-slate-50/80">
                <td className="px-5 py-4">
                  <div className="font-bold text-gray-900">{r.name || r.plate}</div>
                  <div className="text-xs font-mono text-gray-500">{r.plate}</div>
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${
                      r.available
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}
                  >
                    {r.available ? 'Διαθέσιμο' : 'Μη διαθέσιμο'}
                  </span>
                  {r.service_status ? (
                    <div className="text-[11px] text-gray-500 mt-1">Service: {r.service_status}</div>
                  ) : null}
                </td>
                <td className="px-5 py-4 text-sm text-gray-600 max-w-md">{r.reason || r.warning || '—'}</td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-12 text-center">
                  <span className="material-symbols-outlined text-4xl text-gray-300 mb-2 block">directions_bus</span>
                  <p className="text-sm font-bold text-gray-700">
                    {rows.length === 0 ? 'Δεν υπάρχουν οχήματα στον στόλο.' : 'Κανένα αποτέλεσμα για τα φίλτρα.'}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
