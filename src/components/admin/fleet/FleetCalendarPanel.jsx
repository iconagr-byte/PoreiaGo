import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { fetchFleetCalendar, fetchFleetVehicles } from '../../../services/platformApi.js';

const KIND_META = {
  kteo: {
    label: 'ΚΤΕΟ',
    icon: 'car_crash',
    accent: 'from-sky-50 to-blue-50/70',
    border: 'border-sky-100',
    chip: 'bg-sky-100 text-sky-800',
    iconBg: 'bg-sky-500',
  },
  insurance: {
    label: 'Ασφάλεια',
    icon: 'verified_user',
    accent: 'from-emerald-50 to-teal-50/60',
    border: 'border-emerald-100',
    chip: 'bg-emerald-100 text-emerald-800',
    iconBg: 'bg-emerald-500',
  },
  service: {
    label: 'Service',
    icon: 'build_circle',
    accent: 'from-amber-50 to-orange-50/50',
    border: 'border-amber-100',
    chip: 'bg-amber-100 text-amber-800',
    iconBg: 'bg-amber-500',
  },
  document: {
    label: 'Έγγραφο',
    icon: 'folder_managed',
    accent: 'from-violet-50 to-indigo-50/50',
    border: 'border-violet-100',
    chip: 'bg-violet-100 text-violet-800',
    iconBg: 'bg-violet-500',
  },
};

const HORIZON_OPTIONS = [
  { value: 30, label: '30 ημέρες' },
  { value: 90, label: '90 ημέρες' },
  { value: 120, label: '120 ημέρες' },
  { value: 365, label: '1 έτος' },
];

function formatDue(iso) {
  if (!iso) return '—';
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('el-GR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function monthKey(iso) {
  if (!iso) return 'unknown';
  return String(iso).slice(0, 7);
}

function monthLabel(key) {
  if (key === 'unknown') return 'Χωρίς ημερομηνία';
  try {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('el-GR', { month: 'long', year: 'numeric' });
  } catch {
    return key;
  }
}

function daysBadge(daysLeft) {
  if (daysLeft == null) return { text: '—', className: 'bg-slate-100 text-slate-600' };
  if (daysLeft < 0) {
    return {
      text: `Ληγμένο ${Math.abs(daysLeft)}η`,
      className: 'bg-rose-100 text-rose-800 border border-rose-200',
    };
  }
  if (daysLeft === 0) {
    return { text: 'Σήμερα', className: 'bg-rose-100 text-rose-800 border border-rose-200' };
  }
  if (daysLeft <= 14) {
    return {
      text: `${daysLeft} ημέρες`,
      className: 'bg-rose-50 text-rose-700 border border-rose-200',
    };
  }
  if (daysLeft <= 45) {
    return {
      text: `${daysLeft} ημέρες`,
      className: 'bg-amber-50 text-amber-800 border border-amber-200',
    };
  }
  return {
    text: `${daysLeft} ημέρες`,
    className: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  };
}

export default function FleetCalendarPanel({ onOpenDocuments, onOpenFleet }) {
  const [items, setItems] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [withinDays, setWithinDays] = useState(120);
  const [kindFilter, setKindFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('timeline'); // timeline | month

  const load = async (days = withinDays) => {
    setLoading(true);
    try {
      const [cal, fleet] = await Promise.all([
        fetchFleetCalendar(days),
        fetchFleetVehicles().catch(() => []),
      ]);
      setItems(Array.isArray(cal) ? cal : []);
      setVehicles(Array.isArray(fleet) ? fleet : []);
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

  const gaps = useMemo(() => {
    const missingKteo = vehicles.filter((v) => !v.legal_deadline && v.days_to_legal_deadline == null).length;
    const missingIns = vehicles.filter((v) => !v.insurance_due_date).length;
    return { missingKteo, missingIns, total: vehicles.length };
  }, [vehicles]);

  const stats = useMemo(() => {
    const overdue = items.filter((i) => Number(i.days_left) < 0).length;
    const urgent = items.filter((i) => i.severity === 'urgent' || Number(i.days_left) <= 14).length;
    const warning = items.filter((i) => i.severity === 'warning' && Number(i.days_left) > 14).length;
    const byKind = Object.fromEntries(
      Object.keys(KIND_META).map((k) => [k, items.filter((i) => i.kind === k).length]),
    );
    return { overdue, urgent, warning, byKind, total: items.length };
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((item) => (kindFilter === 'all' ? true : item.kind === kindFilter))
      .filter((item) => {
        if (severityFilter === 'all') return true;
        if (severityFilter === 'overdue') return Number(item.days_left) < 0;
        if (severityFilter === 'urgent') {
          return item.severity === 'urgent' || Number(item.days_left) <= 14;
        }
        return item.severity === 'warning' && Number(item.days_left) > 14;
      })
      .filter((item) => {
        if (!q) return true;
        return (
          String(item.title || '').toLowerCase().includes(q) ||
          String(item.plate_number || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const da = Number(a.days_left);
        const db = Number(b.days_left);
        if (Number.isFinite(da) && Number.isFinite(db) && da !== db) return da - db;
        return String(a.due_date || '').localeCompare(String(b.due_date || ''));
      });
  }, [items, kindFilter, severityFilter, query]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const item of filtered) {
      const key = monthKey(item.due_date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const monthGrid = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const first = new Date(year, month, 1);
    const startPad = (first.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const byDay = new Map();
    for (const item of filtered) {
      if (!item.due_date) continue;
      const d = new Date(`${item.due_date}T12:00:00`);
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      const day = d.getDate();
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(item);
    }
    const cells = [];
    for (let i = 0; i < startPad; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ day, items: byDay.get(day) || [] });
    }
    return {
      label: now.toLocaleDateString('el-GR', { month: 'long', year: 'numeric' }),
      cells,
      today: now.getDate(),
    };
  }, [filtered]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-10">
      <section className="relative overflow-hidden rounded-[32px] border border-amber-100/80 bg-gradient-to-br from-amber-50 via-white to-sky-50 p-5 sm:p-6 shadow-[0_12px_40px_rgba(245,158,11,0.08)]">
        <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-amber-300/20 blur-2xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-14 left-1/4 h-40 w-40 rounded-full bg-sky-300/20 blur-2xl" aria-hidden />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/25 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                calendar_month
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Ημερολόγιο στόλου
              </h2>
              <p className="text-sm text-slate-600 mt-1 max-w-xl">
                ΚΤΕΟ, ασφάλειες, service και λήξεις εγγράφων — με φίλτρα και γρήγορη επισκόπηση.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-full bg-white/90 border border-amber-100 px-3 py-2 text-sm font-bold text-slate-700 shadow-sm">
              <span className="material-symbols-outlined text-[18px] text-amber-600">timelapse</span>
              Ορίζοντας
              <select
                className="bg-transparent outline-none font-bold text-slate-900"
                value={withinDays}
                onChange={(e) => setWithinDays(Number(e.target.value))}
              >
                {HORIZON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => load()}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white px-4 py-2 text-sm font-bold hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              Ανανέωση
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Σύνολο',
            value: stats.total,
            icon: 'event_note',
            tone: 'from-slate-50 to-white border-slate-200 text-slate-900',
            iconTone: 'bg-slate-200 text-slate-700',
          },
          {
            label: 'Επείγοντα',
            value: stats.urgent,
            icon: 'priority_high',
            tone: 'from-rose-50 to-white border-rose-100 text-rose-800',
            iconTone: 'bg-rose-100 text-rose-700',
          },
          {
            label: 'Ληγμένα',
            value: stats.overdue,
            icon: 'event_busy',
            tone: 'from-orange-50 to-white border-orange-100 text-orange-800',
            iconTone: 'bg-orange-100 text-orange-700',
          },
          {
            label: 'Προσεχή',
            value: stats.warning,
            icon: 'schedule',
            tone: 'from-amber-50 to-white border-amber-100 text-amber-800',
            iconTone: 'bg-amber-100 text-amber-700',
          },
        ].map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => {
              if (card.label === 'Επείγοντα') setSeverityFilter('urgent');
              else if (card.label === 'Ληγμένα') setSeverityFilter('overdue');
              else if (card.label === 'Προσεχή') setSeverityFilter('warning');
              else setSeverityFilter('all');
            }}
            className={`text-left rounded-3xl border bg-gradient-to-br p-4 shadow-sm hover:-translate-y-0.5 transition-transform ${card.tone}`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${card.iconTone}`}>
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {card.icon}
              </span>
            </div>
            <div className="text-[11px] font-bold uppercase tracking-wider opacity-70">{card.label}</div>
            <div className="text-2xl font-bold mt-0.5">{loading ? '—' : card.value}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-col xl:flex-row gap-3 xl:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setKindFilter('all')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold border transition-colors ${
              kindFilter === 'all'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            Όλα ({stats.total})
          </button>
          {Object.entries(KIND_META).map(([id, meta]) => (
            <button
              key={id}
              type="button"
              onClick={() => setKindFilter(id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold border inline-flex items-center gap-1.5 transition-colors ${
                kindFilter === id ? `${meta.chip} border-transparent` : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">{meta.icon}</span>
              {meta.label} ({stats.byKind[id] || 0})
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1 sm:flex-none">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
              search
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Πινακίδα ή τίτλος…"
              className="w-full sm:w-56 rounded-full border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5">
            {[
              { id: 'timeline', icon: 'view_agenda', label: 'Λίστα' },
              { id: 'month', icon: 'calendar_view_month', label: 'Μήνας' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setView(opt.id)}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  view === opt.id ? 'bg-amber-100 text-amber-900' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {(gaps.missingKteo > 0 || gaps.missingIns > 0) && (
        <div className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-white px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">info</span>
            </span>
            <div className="text-sm text-slate-700">
              <p className="font-bold text-slate-900">Ελλιπή στοιχεία στόλου</p>
              <p className="text-slate-600 mt-0.5">
                {gaps.missingKteo > 0 && <span>{gaps.missingKteo} χωρίς ΚΤΕΟ · </span>}
                {gaps.missingIns > 0 && <span>{gaps.missingIns} χωρίς ασφάλεια · </span>}
                {gaps.total} οχήματα συνολικά
              </p>
            </div>
          </div>
          {onOpenFleet && (
            <button
              type="button"
              onClick={onOpenFleet}
              className="text-sm font-bold text-sky-800 hover:underline inline-flex items-center gap-1 shrink-0"
            >
              Άνοιγμα στόλου
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          )}
        </div>
      )}

      {loading && (
        <div className="grid gap-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 rounded-3xl bg-slate-100/80 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-[28px] border border-dashed border-amber-200 bg-gradient-to-br from-white to-amber-50/40 px-6 py-14 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              event_available
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900">Καμία λήξη στο διάστημα</h3>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
            Δεν υπάρχουν προσεχείς λήξεις για τα τρέχοντα φίλτρα. Δοκίμασε μεγαλύτερο ορίζοντα ή πρόσθεσε
            ημερομηνίες ΚΤΕΟ/ασφάλειας στα οχήματα.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setKindFilter('all');
                setSeverityFilter('all');
                setQuery('');
                setWithinDays(365);
              }}
              className="rounded-full bg-amber-500 text-white px-4 py-2 text-sm font-bold hover:bg-amber-600"
            >
              Δες 1 έτος
            </button>
            {onOpenDocuments && (
              <button
                type="button"
                onClick={onOpenDocuments}
                className="rounded-full bg-white border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Έγγραφα στόλου
              </button>
            )}
            {onOpenFleet && (
              <button
                type="button"
                onClick={onOpenFleet}
                className="rounded-full bg-slate-900 text-white px-4 py-2 text-sm font-bold hover:bg-slate-800"
              >
                Επεξεργασία στόλου
              </button>
            )}
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && view === 'month' && (
        <div className="rounded-[28px] border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 capitalize">{monthGrid.label}</h3>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              {filtered.length} γεγονότα (φίλτρο)
            </p>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold text-slate-400 uppercase mb-2">
            {['Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα', 'Κυ'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {monthGrid.cells.map((cell, idx) => {
              if (!cell) return <div key={`pad-${idx}`} className="min-h-[4.5rem] rounded-xl bg-slate-50/50" />;
              const hasUrgent = cell.items.some(
                (i) => i.severity === 'urgent' || Number(i.days_left) <= 14,
              );
              const hasAny = cell.items.length > 0;
              return (
                <div
                  key={cell.day}
                  className={`min-h-[4.5rem] rounded-xl border p-1.5 text-left transition-colors ${
                    cell.day === monthGrid.today
                      ? 'border-amber-300 bg-amber-50/70 ring-1 ring-amber-200'
                      : hasUrgent
                        ? 'border-rose-200 bg-rose-50/50'
                        : hasAny
                          ? 'border-sky-100 bg-sky-50/40'
                          : 'border-slate-100 bg-white'
                  }`}
                  title={cell.items.map((i) => i.title).join('\n')}
                >
                  <div className="text-xs font-bold text-slate-700">{cell.day}</div>
                  {hasAny && (
                    <div className="mt-1 space-y-0.5">
                      {cell.items.slice(0, 2).map((item) => (
                        <div
                          key={item.id}
                          className="truncate text-[10px] font-bold text-slate-600 bg-white/80 rounded px-1"
                        >
                          {item.plate_number || KIND_META[item.kind]?.label || item.kind}
                        </div>
                      ))}
                      {cell.items.length > 2 && (
                        <div className="text-[10px] font-bold text-slate-400">+{cell.items.length - 2}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && view === 'timeline' && (
        <div className="space-y-6">
          {grouped.map(([key, rows]) => (
            <section key={key} className="space-y-3">
              <div className="flex items-center gap-3 px-1">
                <h3 className="text-sm font-bold text-slate-800 capitalize">{monthLabel(key)}</h3>
                <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
                <span className="text-xs font-bold text-slate-400">{rows.length}</span>
              </div>
              <div className="space-y-3">
                {rows.map((item) => {
                  const meta = KIND_META[item.kind] || KIND_META.document;
                  const badge = daysBadge(item.days_left);
                  return (
                    <article
                      key={item.id}
                      className={`group relative overflow-hidden rounded-[24px] border bg-gradient-to-br ${meta.accent} ${meta.border} p-4 sm:p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(15,23,42,0.08)] transition-all duration-300`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`w-11 h-11 rounded-2xl ${meta.iconBg} text-white shadow-md flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}
                          >
                            <span
                              className="material-symbols-outlined text-[22px]"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              {meta.icon}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${meta.chip}`}>
                                {meta.label}
                              </span>
                              <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${badge.className}`}>
                                {badge.text}
                              </span>
                            </div>
                            <h4 className="font-bold text-slate-900 text-base leading-snug truncate">
                              {item.title}
                            </h4>
                            <p className="text-xs text-slate-500 font-mono mt-1">
                              {item.plate_number || '—'}
                              {item.km_to_service != null
                                ? ` · ${Number(item.km_to_service).toLocaleString('el-GR')} km έως service`
                                : ''}
                            </p>
                          </div>
                        </div>
                        <div className="sm:text-right shrink-0 pl-14 sm:pl-0">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Ημερομηνία
                          </div>
                          <div className="text-sm font-bold text-slate-800 mt-0.5">
                            {formatDue(item.due_date)}
                          </div>
                          {onOpenDocuments && item.kind === 'document' && (
                            <button
                              type="button"
                              onClick={onOpenDocuments}
                              className="mt-2 text-xs font-bold text-violet-700 hover:underline inline-flex items-center gap-0.5"
                            >
                              Έγγραφα
                              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
