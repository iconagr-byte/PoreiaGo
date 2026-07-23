import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { fetchFleetAvailabilityBoard } from '../../../services/platformApi.js';

export default function FleetAvailabilityPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFleetAvailabilityBoard()
      .then(setRows)
      .catch((err) => toast.error(err.message || 'Αποτυχία διαθεσιμότητας'))
      .finally(() => setLoading(false));
  }, []);

  const available = rows.filter((r) => r.available).length;
  const blocked = rows.length - available;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Διαθεσιμότητα στόλου</h2>
        <p className="text-sm text-gray-500 mt-1">
          Ποια οχήματα δέχονται νέες κρατήσεις (service / ΚΤΕΟ / ασφάλεια).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="bg-white rounded-2xl border p-4">
          <div className="text-xs font-bold text-gray-500 uppercase">Διαθέσιμα</div>
          <div className="text-3xl font-bold text-emerald-600">{available}</div>
        </div>
        <div className="bg-white rounded-2xl border p-4">
          <div className="text-xs font-bold text-gray-500 uppercase">Μπλοκαρισμένα</div>
          <div className="text-3xl font-bold text-rose-600">{blocked}</div>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Φόρτωση…</p>}

      <div className="bg-white rounded-[28px] border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead>
            <tr>
              <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Όχημα</th>
              <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Κατάσταση</th>
              <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Λόγος</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.vehicle_id || r.plate}>
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
                  {r.service_status && (
                    <div className="text-[11px] text-gray-500 mt-1">Service: {r.service_status}</div>
                  )}
                </td>
                <td className="px-5 py-4 text-sm text-gray-600 max-w-md">
                  {r.reason || r.warning || '—'}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-sm text-gray-500">
                  Δεν υπάρχουν οχήματα στον στόλο.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
