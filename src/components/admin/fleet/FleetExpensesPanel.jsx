import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  createFleetExpense,
  deleteFleetExpense,
  fetchFleetExpenses,
  fetchFleetVehicles,
} from '../../../services/platformApi.js';

const CATEGORIES = [
  { id: 'fuel', label: 'Καύσιμα', icon: 'local_gas_station', tone: 'amber' },
  { id: 'tolls', label: 'Διόδια', icon: 'toll', tone: 'sky' },
  { id: 'insurance', label: 'Ασφάλεια', icon: 'verified_user', tone: 'violet' },
  { id: 'other', label: 'Άλλο', icon: 'receipt_long', tone: 'slate' },
];

const TONE = {
  amber: {
    chip: 'bg-amber-50 text-amber-900 border-amber-200',
    soft: 'bg-amber-100 text-amber-800',
    bar: 'bg-amber-500',
  },
  sky: {
    chip: 'bg-sky-50 text-sky-900 border-sky-200',
    soft: 'bg-sky-100 text-sky-800',
    bar: 'bg-sky-500',
  },
  violet: {
    chip: 'bg-violet-50 text-violet-900 border-violet-200',
    soft: 'bg-violet-100 text-violet-800',
    bar: 'bg-violet-500',
  },
  slate: {
    chip: 'bg-slate-50 text-slate-800 border-slate-200',
    soft: 'bg-slate-100 text-slate-700',
    bar: 'bg-slate-500',
  },
};

const EMPTY = {
  vehicle_id: '',
  expense_date: new Date().toISOString().slice(0, 10),
  category: 'fuel',
  amount: '',
  liters: '',
  odometer: '',
  note: '',
};

function euro(n) {
  return `€${Number(n || 0).toLocaleString('el-GR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function catMeta(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[3];
}

function monthKey(iso) {
  return String(iso || '').slice(0, 7);
}

function formatDateEl(iso) {
  if (!iso) return '—';
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('el-GR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function FleetExpensesPanel() {
  const [rows, setRows] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [filterCat, setFilterCat] = useState('all');
  const [filterVehicle, setFilterVehicle] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(true);

  const reload = async ({ soft = false } = {}) => {
    if (!soft) setLoading(true);
    try {
      const [e, v] = await Promise.all([fetchFleetExpenses(), fetchFleetVehicles()]);
      setRows(Array.isArray(e) ? e : []);
      setVehicles(Array.isArray(v) ? v : []);
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

  const months = useMemo(() => {
    const keys = [...new Set(rows.map((r) => monthKey(r.expense_date)).filter(Boolean))];
    keys.sort((a, b) => b.localeCompare(a));
    return keys;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => (filterCat === 'all' ? true : r.category === filterCat))
      .filter((r) => (filterVehicle === 'all' ? true : r.vehicle_id === filterVehicle))
      .filter((r) => (filterMonth === 'all' ? true : monthKey(r.expense_date) === filterMonth))
      .filter((r) => {
        if (!q) return true;
        const v = vehicles.find((x) => x.id === r.vehicle_id);
        const hay = [
          r.note,
          r.category,
          v?.plate_number,
          v?.make,
          v?.model,
          String(r.amount),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => String(b.expense_date || '').localeCompare(String(a.expense_date || '')));
  }, [rows, filterCat, filterVehicle, filterMonth, query, vehicles]);

  const stats = useMemo(() => {
    const total = filtered.reduce((s, r) => s + Number(r.amount || 0), 0);
    const byCat = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0]));
    let fuelLiters = 0;
    for (const r of filtered) {
      byCat[r.category] = (byCat[r.category] || 0) + Number(r.amount || 0);
      if (r.category === 'fuel' && r.liters != null) fuelLiters += Number(r.liters || 0);
    }
    const fuelAmt = byCat.fuel || 0;
    const eurPerL = fuelLiters > 0 ? fuelAmt / fuelLiters : null;
    return { total, byCat, count: filtered.length, fuelLiters, eurPerL };
  }, [filtered]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.vehicle_id || !form.amount) {
      toast.error('Όχημα και ποσό είναι υποχρεωτικά');
      return;
    }
    const amount = Number(form.amount);
    if (!(amount > 0)) {
      toast.error('Το ποσό πρέπει να είναι μεγαλύτερο από 0');
      return;
    }
    setSaving(true);
    try {
      await createFleetExpense({
        vehicle_id: form.vehicle_id,
        expense_date: form.expense_date,
        category: form.category,
        amount,
        liters:
          form.category === 'fuel' && form.liters !== '' ? Number(form.liters) : null,
        odometer: form.odometer !== '' ? Number(form.odometer) : null,
        note: form.note,
      });
      toast.success('Το έξοδο καταχωρίστηκε');
      setForm((f) => ({
        ...EMPTY,
        vehicle_id: f.vehicle_id,
        category: f.category,
        expense_date: f.expense_date,
      }));
      await reload({ soft: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm('Διαγραφή εξόδου;')) return;
    setDeletingId(id);
    try {
      await deleteFleetExpense(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success('Διαγράφηκε');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const vehicleLabel = (id) => {
    const v = vehicles.find((x) => x.id === id);
    if (!v) return id || '—';
    return `${v.plate_number}${v.make ? ` · ${v.make}` : ''}${v.model ? ` ${v.model}` : ''}`;
  };

  const isFuel = form.category === 'fuel';

  return (
    <div className="space-y-4 pb-2">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="rounded-2xl border border-black/[0.06] bg-gradient-to-br from-white to-amber-50/40 px-4 py-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Σύνολο</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{euro(stats.total)}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{stats.count} καταχωρίσεις</p>
        </div>
        <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700/80">Καύσιμα</p>
          <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">
            {euro(stats.byCat.fuel)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {stats.fuelLiters > 0
              ? `${stats.fuelLiters.toLocaleString('el-GR')} L${
                  stats.eurPerL != null ? ` · ${euro(stats.eurPerL)}/L` : ''
                }`
              : 'χωρίς λίτρα ακόμα'}
          </p>
        </div>
        <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700/80">Διόδια</p>
          <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">
            {euro(stats.byCat.tolls)}
          </p>
        </div>
        <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700/80">
            Ασφάλεια + άλλο
          </p>
          <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">
            {euro((stats.byCat.insurance || 0) + (stats.byCat.other || 0))}
          </p>
        </div>
      </div>

      {/* Category breakdown bar */}
      {stats.total > 0 ? (
        <div className="rounded-2xl border border-black/[0.05] bg-white/80 px-3.5 py-3">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
            {CATEGORIES.map((c) => {
              const amt = stats.byCat[c.id] || 0;
              if (amt <= 0) return null;
              const pct = Math.max(4, (amt / stats.total) * 100);
              return (
                <div
                  key={c.id}
                  className={`${TONE[c.tone].bar} first:rounded-l-full last:rounded-r-full`}
                  style={{ width: `${pct}%` }}
                  title={`${c.label}: ${euro(amt)}`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {CATEGORIES.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
                <span className={`h-2 w-2 rounded-full ${TONE[c.tone].bar}`} />
                {c.label} {euro(stats.byCat[c.id])}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Entry form */}
      <section className="rounded-[24px] border border-black/[0.06] bg-white shadow-[0_8px_28px_rgba(15,23,42,0.04)] overflow-hidden">
        <button
          type="button"
          onClick={() => setFormOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 text-left hover:bg-slate-50/80 transition-colors"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                add_card
              </span>
            </span>
            <span>
              <span className="block text-sm font-bold text-slate-900">Νέα καταχώριση</span>
              <span className="block text-[12px] text-slate-500">
                Καύσιμα, διόδια ή άλλο κόστος ανά όχημα
              </span>
            </span>
          </span>
          <span className="material-symbols-outlined text-slate-400">
            {formOpen ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {formOpen ? (
          <form onSubmit={onSubmit} className="border-t border-black/[0.05] px-4 sm:px-5 py-4 space-y-4">
            {!vehicles.length && !loading ? (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                Δεν υπάρχουν οχήματα. Προσθέστε όχημα στον στόλο για να καταχωρίσετε έξοδα.
              </p>
            ) : null}

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
                Κατηγορία
              </p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => {
                  const active = form.category === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, category: c.id }))}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition ${
                        active
                          ? `${TONE[c.tone].chip} shadow-sm`
                          : 'bg-white text-slate-600 border-black/[0.08] hover:bg-slate-50'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">{c.icon}</span>
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <label className="text-[12px] font-bold text-slate-600">
                Όχημα
                <select
                  className="mt-1 w-full rounded-xl border border-black/[0.08] bg-slate-50/50 px-3 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                  value={form.vehicle_id}
                  onChange={(e) => setForm((f) => ({ ...f, vehicle_id: e.target.value }))}
                  required
                >
                  {!vehicles.length ? <option value="">—</option> : null}
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate_number} · {v.make} {v.model}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[12px] font-bold text-slate-600">
                Ημερομηνία
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-black/[0.08] bg-slate-50/50 px-3 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                  value={form.expense_date}
                  onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
                  required
                />
              </label>
              <label className="text-[12px] font-bold text-slate-600">
                Ποσό (€)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="mt-1 w-full rounded-xl border border-black/[0.08] bg-slate-50/50 px-3 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  required
                />
              </label>
              {isFuel ? (
                <label className="text-[12px] font-bold text-slate-600">
                  Λίτρα
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    inputMode="decimal"
                    placeholder="π.χ. 45"
                    className="mt-1 w-full rounded-xl border border-black/[0.08] bg-slate-50/50 px-3 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                    value={form.liters}
                    onChange={(e) => setForm((f) => ({ ...f, liters: e.target.value }))}
                  />
                </label>
              ) : null}
              <label className="text-[12px] font-bold text-slate-600">
                Χιλιόμετρα (οδόμετρο)
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="προαιρετικό"
                  className="mt-1 w-full rounded-xl border border-black/[0.08] bg-slate-50/50 px-3 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                  value={form.odometer}
                  onChange={(e) => setForm((f) => ({ ...f, odometer: e.target.value }))}
                />
              </label>
              <label className={`text-[12px] font-bold text-slate-600 ${isFuel ? 'sm:col-span-2 lg:col-span-1' : 'sm:col-span-2'}`}>
                Σημείωση
                <input
                  className="mt-1 w-full rounded-xl border border-black/[0.08] bg-slate-50/50 px-3 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                  value={form.note}
                  placeholder="π.χ. πρατήριο, διαδρομή…"
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-[12px] text-slate-500">
                {isFuel && form.amount && form.liters
                  ? `≈ ${euro(Number(form.amount) / Number(form.liters))}/L`
                  : 'Τα υποχρεωτικά πεδία: όχημα, ημερομηνία, ποσό'}
              </p>
              <button
                type="submit"
                disabled={saving || !vehicles.length}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {saving ? 'progress_activity' : 'check'}
                </span>
                {saving ? 'Αποθήκευση…' : 'Καταχώριση'}
              </button>
            </div>
          </form>
        ) : null}
      </section>

      {/* Filters + list */}
      <section className="rounded-[24px] border border-black/[0.06] bg-white shadow-[0_8px_28px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-black/[0.05] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Ιστορικό εξόδων</h3>
              <p className="text-[12px] text-slate-500 mt-0.5">
                {loading ? 'Φόρτωση…' : `${filtered.length} από ${rows.length} εγγραφές`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => reload()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-black/[0.08] bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>
                refresh
              </span>
              Ανανέωση
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilterCat('all')}
              className={`rounded-full px-3 py-1.5 text-xs font-bold border transition ${
                filterCat === 'all'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-black/[0.08]'
              }`}
            >
              Όλα
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setFilterCat(c.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold border transition ${
                  filterCat === c.id
                    ? TONE[c.tone].chip
                    : 'bg-white text-slate-600 border-black/[0.08]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="grid sm:grid-cols-3 gap-2">
            <label className="text-[11px] font-bold text-slate-500">
              Όχημα
              <select
                className="mt-1 w-full rounded-xl border border-black/[0.08] px-3 py-2 text-sm font-semibold text-slate-800"
                value={filterVehicle}
                onChange={(e) => setFilterVehicle(e.target.value)}
              >
                <option value="all">Όλα τα οχήματα</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate_number}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-bold text-slate-500">
              Μήνας
              <select
                className="mt-1 w-full rounded-xl border border-black/[0.08] px-3 py-2 text-sm font-semibold text-slate-800"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
              >
                <option value="all">Όλοι οι μήνες</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-bold text-slate-500">
              Αναζήτηση
              <input
                className="mt-1 w-full rounded-xl border border-black/[0.08] px-3 py-2 text-sm font-semibold text-slate-800"
                placeholder="πινακίδα, σημείωση…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
        </div>

        {/* Mobile cards */}
        <ul className="sm:hidden divide-y divide-slate-100">
          {filtered.map((r) => {
            const meta = catMeta(r.category);
            return (
              <li key={r.id} className="px-4 py-3.5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{formatDateEl(r.expense_date)}</p>
                    <p className="text-xs font-mono text-slate-600 mt-0.5 truncate">
                      {vehicleLabel(r.vehicle_id)}
                    </p>
                  </div>
                  <p className="text-base font-bold text-slate-900 shrink-0">{euro(r.amount)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${TONE[meta.tone].chip}`}
                  >
                    <span className="material-symbols-outlined text-[13px]">{meta.icon}</span>
                    {meta.label}
                    {r.liters != null ? ` · ${r.liters} L` : ''}
                  </span>
                  {r.odometer != null ? (
                    <span className="text-[11px] text-slate-500">{Number(r.odometer).toLocaleString('el-GR')} km</span>
                  ) : null}
                  <button
                    type="button"
                    disabled={deletingId === r.id}
                    className="ml-auto text-[11px] font-bold text-rose-600 disabled:opacity-50"
                    onClick={() => onDelete(r.id)}
                  >
                    Διαγραφή
                  </button>
                </div>
                {r.note ? <p className="text-[12px] text-slate-500 leading-snug">{r.note}</p> : null}
              </li>
            );
          })}
          {!loading && filtered.length === 0 ? (
            <li className="px-4 py-12 text-center">
              <span className="material-symbols-outlined text-[36px] text-slate-300">receipt_long</span>
              <p className="mt-2 text-sm font-bold text-slate-700">Καμία καταχώριση</p>
              <p className="mt-1 text-[12px] text-slate-500">
                {rows.length ? 'Δοκιμάστε άλλα φίλτρα.' : 'Καταχωρίστε το πρώτο έξοδο παραπάνω.'}
              </p>
            </li>
          ) : null}
        </ul>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-slate-50/80 text-left">
                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Ημ/νία
                </th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Όχημα
                </th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Κατηγορία
                </th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Λεπτομέρειες
                </th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide text-right">
                  Ποσό
                </th>
                <th className="px-5 py-3 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => {
                const meta = catMeta(r.category);
                return (
                  <tr key={r.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-semibold text-slate-800 whitespace-nowrap">
                      {formatDateEl(r.expense_date)}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-mono font-semibold text-slate-800">
                      {vehicles.find((x) => x.id === r.vehicle_id)?.plate_number || r.vehicle_id}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${TONE[meta.tone].chip}`}
                      >
                        <span className="material-symbols-outlined text-[14px]">{meta.icon}</span>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[12px] text-slate-500 max-w-[16rem]">
                      <span className="line-clamp-2">
                        {[
                          r.liters != null ? `${r.liters} L` : null,
                          r.odometer != null
                            ? `${Number(r.odometer).toLocaleString('el-GR')} km`
                            : null,
                          r.note || null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-bold text-right text-slate-900 whitespace-nowrap">
                      {euro(r.amount)}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <button
                        type="button"
                        title="Διαγραφή"
                        disabled={deletingId === r.id}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                        onClick={() => onDelete(r.id)}
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center">
                    <span className="material-symbols-outlined text-[40px] text-slate-300">
                      receipt_long
                    </span>
                    <p className="mt-2 text-sm font-bold text-slate-700">Καμία καταχώριση</p>
                    <p className="mt-1 text-[12px] text-slate-500">
                      {rows.length
                        ? 'Δοκιμάστε άλλα φίλτρα ή καθαρίστε την αναζήτηση.'
                        : 'Καταχωρίστε το πρώτο έξοδο από τη φόρμα παραπάνω.'}
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
