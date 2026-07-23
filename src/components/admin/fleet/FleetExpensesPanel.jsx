import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  createFleetExpense,
  deleteFleetExpense,
  fetchFleetExpenses,
  fetchFleetVehicles,
} from '../../../services/platformApi.js';

const CATEGORIES = [
  { id: 'fuel', label: 'Καύσιμα' },
  { id: 'tolls', label: 'Διόδια' },
  { id: 'insurance', label: 'Ασφάλεια' },
  { id: 'other', label: 'Άλλο' },
];

const EMPTY = {
  vehicle_id: '',
  expense_date: new Date().toISOString().slice(0, 10),
  category: 'fuel',
  amount: '',
  liters: '',
  odometer: '',
  note: '',
};

export default function FleetExpensesPanel() {
  const [rows, setRows] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [e, v] = await Promise.all([fetchFleetExpenses(), fetchFleetVehicles()]);
      setRows(e);
      setVehicles(v);
      setForm((f) => ({ ...f, vehicle_id: f.vehicle_id || v[0]?.id || '' }));
    } catch (err) {
      toast.error(err.message || 'Αποτυχία εξόδων');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.vehicle_id || !form.amount) {
      toast.error('Όχημα και ποσό είναι υποχρεωτικά');
      return;
    }
    setSaving(true);
    try {
      await createFleetExpense({
        vehicle_id: form.vehicle_id,
        expense_date: form.expense_date,
        category: form.category,
        amount: Number(form.amount),
        liters: form.liters !== '' ? Number(form.liters) : null,
        odometer: form.odometer !== '' ? Number(form.odometer) : null,
        note: form.note,
      });
      toast.success('Καταχωρίστηκε');
      setForm((f) => ({ ...EMPTY, vehicle_id: f.vehicle_id }));
      await reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-8">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Έξοδα στόλου</h2>
          <p className="text-sm text-gray-500 mt-1">Καύσιμα, διόδια και άλλα ανά όχημα.</p>
        </div>
        <div className="bg-white rounded-2xl border px-5 py-3">
          <div className="text-[10px] font-bold uppercase text-gray-500">Σύνολο</div>
          <div className="text-2xl font-bold text-primary">€{total.toLocaleString('el-GR')}</div>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="bg-white rounded-[28px] border p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
      >
        <label className="text-sm font-bold text-gray-700">
          Όχημα
          <select
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={form.vehicle_id}
            onChange={(e) => setForm((f) => ({ ...f, vehicle_id: e.target.value }))}
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate_number} · {v.make} {v.model}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold text-gray-700">
          Κατηγορία
          <select
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold text-gray-700">
          Ημερομηνία
          <input
            type="date"
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={form.expense_date}
            onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
          />
        </label>
        <label className="text-sm font-bold text-gray-700">
          Ποσό (€)
          <input
            type="number"
            min="0"
            step="0.01"
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            required
          />
        </label>
        <label className="text-sm font-bold text-gray-700">
          Λίτρα (καύσιμα)
          <input
            type="number"
            min="0"
            step="0.1"
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={form.liters}
            onChange={(e) => setForm((f) => ({ ...f, liters: e.target.value }))}
          />
        </label>
        <label className="text-sm font-bold text-gray-700">
          Χιλιόμετρα
          <input
            type="number"
            min="0"
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={form.odometer}
            onChange={(e) => setForm((f) => ({ ...f, odometer: e.target.value }))}
          />
        </label>
        <label className="text-sm font-bold text-gray-700 sm:col-span-2">
          Σημείωση
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving || !vehicles.length}
            className="w-full px-4 py-2.5 rounded-full bg-primary text-white text-sm font-bold disabled:opacity-50"
          >
            {saving ? 'Αποθήκευση…' : 'Καταχώριση'}
          </button>
        </div>
      </form>

      {loading && <p className="text-sm text-gray-500">Φόρτωση…</p>}

      <div className="bg-white rounded-[28px] border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead>
            <tr>
              <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Ημ/νία</th>
              <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Όχημα</th>
              <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Κατηγορία</th>
              <th className="px-5 py-3 text-right text-xs font-bold text-gray-500 uppercase">Ποσό</th>
              <th className="px-5 py-3 text-right text-xs font-bold text-gray-500 uppercase"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => {
              const v = vehicles.find((x) => x.id === r.vehicle_id);
              return (
                <tr key={r.id}>
                  <td className="px-5 py-3 text-sm">{r.expense_date}</td>
                  <td className="px-5 py-3 text-sm font-mono">
                    {v ? `${v.plate_number}` : r.vehicle_id}
                  </td>
                  <td className="px-5 py-3 text-sm capitalize">
                    {CATEGORIES.find((c) => c.id === r.category)?.label || r.category}
                    {r.liters != null ? ` · ${r.liters} L` : ''}
                  </td>
                  <td className="px-5 py-3 text-sm font-bold text-right">
                    €{Number(r.amount).toLocaleString('el-GR')}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      className="text-xs font-bold text-rose-600"
                      onClick={async () => {
                        if (!window.confirm('Διαγραφή εξόδου;')) return;
                        try {
                          await deleteFleetExpense(r.id);
                          await reload();
                        } catch (err) {
                          toast.error(err.message);
                        }
                      }}
                    >
                      Διαγραφή
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-500">
                  Δεν υπάρχουν καταχωρίσεις ακόμα.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
