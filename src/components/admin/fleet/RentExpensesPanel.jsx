/**
 * Rent-scoped fleet expenses (fuel, tolls, insurance, service…).
 */
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  createRentalExpense,
  deleteRentalExpense,
  fetchRentalExpenses,
  fetchRentalVehicles,
} from '../../../services/fleetRentalApi.js';

const CATEGORIES = [
  { id: 'fuel', label: 'Καύσιμα' },
  { id: 'tolls', label: 'Διόδια' },
  { id: 'insurance', label: 'Ασφάλεια' },
  { id: 'service', label: 'Service' },
  { id: 'cleaning', label: 'Καθαρισμός' },
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

export default function RentExpensesPanel() {
  const [rows, setRows] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [e, v] = await Promise.all([fetchRentalExpenses(), fetchRentalVehicles()]);
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
    if (!form.vehicle_id || form.amount === '') {
      toast.error('Όχημα και ποσό είναι υποχρεωτικά');
      return;
    }
    setSaving(true);
    try {
      await createRentalExpense({
        vehicle_id: form.vehicle_id,
        expense_date: form.expense_date,
        category: form.category,
        amount: Number(form.amount),
        liters: form.liters !== '' ? Number(form.liters) : null,
        odometer: form.odometer !== '' ? Number(form.odometer) : null,
        note: form.note || null,
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

  const total = useMemo(
    () => rows.reduce((s, r) => s + Number(r.amount || 0), 0),
    [rows],
  );

  const byCategory = useMemo(() => {
    const map = {};
    for (const r of rows) {
      map[r.category] = (map[r.category] || 0) + Number(r.amount || 0);
    }
    return map;
  }, [rows]);

  return (
    <div className="space-y-5 pb-4">
      <div className="flex flex-col lg:flex-row justify-between gap-4">
        <div className="rounded-[28px] border border-amber-200/70 bg-gradient-to-br from-amber-50/70 via-white to-orange-50/30 px-5 py-5 flex-1">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-600 text-white shadow-sm">
              <span className="material-symbols-outlined text-[22px]">local_gas_station</span>
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Έξοδα /rent</h2>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                Καύσιμα, διόδια, ασφάλεια και service ανά όχημα ενοικίασης.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-4 shadow-sm min-w-[160px]">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Σύνολο</div>
          <div className="text-3xl font-bold text-slate-900 tabular-nums mt-1">
            €{total.toLocaleString('el-GR', { maximumFractionDigits: 2 })}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CATEGORIES.filter((c) => byCategory[c.id]).map((c) => (
              <span
                key={c.id}
                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
              >
                {c.label} €{byCategory[c.id].toFixed(0)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="bg-white rounded-[28px] border border-slate-200/90 shadow-[0_8px_24px_rgba(15,23,42,0.04)] p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
      >
        <label className="text-sm font-bold text-slate-700">
          Όχημα
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            value={form.vehicle_id}
            onChange={(e) => setForm((f) => ({ ...f, vehicle_id: e.target.value }))}
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate_number} · {v.model}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700">
          Κατηγορία
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
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
        <label className="text-sm font-bold text-slate-700">
          Ημερομηνία
          <input
            type="date"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            value={form.expense_date}
            onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
          />
        </label>
        <label className="text-sm font-bold text-slate-700">
          Ποσό (€)
          <input
            type="number"
            step="0.01"
            min="0"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          />
        </label>
        <label className="text-sm font-bold text-slate-700">
          Λίτρα
          <input
            type="number"
            step="0.1"
            min="0"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            value={form.liters}
            onChange={(e) => setForm((f) => ({ ...f, liters: e.target.value }))}
          />
        </label>
        <label className="text-sm font-bold text-slate-700">
          Χιλιόμετρα
          <input
            type="number"
            min="0"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            value={form.odometer}
            onChange={(e) => setForm((f) => ({ ...f, odometer: e.target.value }))}
          />
        </label>
        <label className="text-sm font-bold text-slate-700 sm:col-span-2">
          Σημείωση
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="π.χ. πλήρωση πριν check-out"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving || !vehicles.length}
            className="w-full rounded-full bg-amber-600 text-white px-4 py-2.5 text-sm font-bold hover:bg-amber-700 disabled:opacity-50"
          >
            {saving ? 'Αποθήκευση…' : 'Καταχώριση εξόδου'}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="h-32 animate-pulse rounded-[24px] bg-slate-100" />
      ) : rows.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-10 text-center text-sm text-slate-500">
          Καμία δαπάνη ακόμα.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-bold">Ημ/νία</th>
                <th className="px-4 py-3 font-bold">Όχημα</th>
                <th className="px-4 py-3 font-bold">Κατηγορία</th>
                <th className="px-4 py-3 font-bold text-right">Ποσό</th>
                <th className="px-4 py-3 font-bold" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 tabular-nums text-slate-700">{r.expense_date}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{r.plate_number}</p>
                    <p className="text-xs text-slate-500">{r.model}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {CATEGORIES.find((c) => c.id === r.category)?.label || r.category}
                    {r.note ? <span className="block text-xs text-slate-400">{r.note}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">
                    €{Number(r.amount || 0).toLocaleString('el-GR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-xs font-bold text-rose-600 hover:underline"
                      onClick={async () => {
                        if (!window.confirm('Διαγραφή δαπάνης;')) return;
                        try {
                          await deleteRentalExpense(r.id);
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
