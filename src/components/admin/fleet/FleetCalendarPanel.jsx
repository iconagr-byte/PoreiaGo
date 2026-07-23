import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { fetchFleetCalendar } from '../../../services/platformApi.js';

const KIND_LABEL = {
  kteo: 'ΚΤΕΟ',
  insurance: 'Ασφάλεια',
  service: 'Service',
  document: 'Έγγραφο',
};

export default function FleetCalendarPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [withinDays, setWithinDays] = useState(120);

  const load = async (days = withinDays) => {
    setLoading(true);
    try {
      setItems(await fetchFleetCalendar(days));
    } catch (err) {
      toast.error(err.message || 'Αποτυχία ημερολογίου');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withinDays]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Ημερολόγιο στόλου</h2>
          <p className="text-sm text-gray-500 mt-1">ΚΤΕΟ, ασφάλειες, service και λήξεις εγγράφων.</p>
        </div>
        <label className="text-sm font-bold text-gray-700">
          Ορίζοντας
          <select
            className="ml-2 rounded-full border px-3 py-2"
            value={withinDays}
            onChange={(e) => setWithinDays(Number(e.target.value))}
          >
            <option value={30}>30 ημέρες</option>
            <option value={90}>90 ημέρες</option>
            <option value={120}>120 ημέρες</option>
            <option value={365}>1 έτος</option>
          </select>
        </label>
      </div>

      {loading && <p className="text-sm text-gray-500">Φόρτωση…</p>}
      {!loading && items.length === 0 && (
        <p className="text-sm text-gray-500 bg-white rounded-2xl border p-8 text-center">
          Δεν υπάρχουν προσεχείς λήξεις στο επιλεγμένο διάστημα.
        </p>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className={`bg-white rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              item.severity === 'urgent' ? 'border-rose-200 bg-rose-50/40' : 'border-amber-100'
            }`}
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {KIND_LABEL[item.kind] || item.kind}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    item.severity === 'urgent'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {item.days_left < 0 ? 'Ληγμένο' : `${item.days_left} ημέρες`}
                </span>
              </div>
              <div className="font-bold text-gray-900">{item.title}</div>
              <div className="text-xs text-gray-500 font-mono mt-0.5">
                {item.plate_number}
                {item.km_to_service != null ? ` · ${Number(item.km_to_service).toLocaleString()} km έως service` : ''}
              </div>
            </div>
            <div className="text-sm font-bold text-gray-700 shrink-0">{item.due_date}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
