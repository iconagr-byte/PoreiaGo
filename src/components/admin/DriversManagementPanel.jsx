import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  deleteFleetDriver,
  fetchFleetDrivers,
} from '../../services/platformApi.js';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';

const STATUS_LABELS = {
  active: 'Ενεργός',
  inactive: 'Ανενεργός',
  on_leave: 'Άδεια',
  suspended: 'Αναστολή',
};

const STATUS_DOT = {
  active: 'bg-emerald-500',
  inactive: 'bg-zinc-300',
  on_leave: 'bg-amber-400',
  suspended: 'bg-rose-500',
};

function safetyTone(score) {
  if (score >= 90) return 'text-emerald-600';
  if (score >= 75) return 'text-amber-600';
  return 'text-rose-600';
}

function driverInitials(name) {
  return (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export default function DriversManagementPanel() {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter((d) => {
      const hay = [d.name, d.email, d.license_no, d.license_plate, d.vehicle_code]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [drivers, query]);

  const load = useCallback(async ({ soft = false } = {}) => {
    if (!soft) setLoading(true);
    setLoadError('');
    try {
      const rows = await fetchFleetDrivers(filter || undefined);
      setDrivers(Array.isArray(rows) ? rows : []);
    } catch (err) {
      if (!soft) setDrivers([]);
      setLoadError(err.message || 'Αποτυχία φόρτωσης οδηγών');
      toast.error(err.message || 'Αποτυχία φόρτωσης οδηγών');
    } finally {
      if (!soft) setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const onDelete = async (d) => {
    if (!window.confirm(`Διαγραφή οδηγού ${d.name};`)) return;
    const prev = drivers;
    // Optimistic: remove instantly — no skeleton flash while DELETE + refetch run.
    setDrivers((rows) => rows.filter((row) => row.id !== d.id));
    try {
      await deleteFleetDriver(d.id);
      toast.success('Διαγράφηκε');
      load({ soft: true });
    } catch (err) {
      setDrivers(prev);
      toast.error(err.message);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
            Εφαρμογή
          </p>
          <h3 className="mt-1 text-[22px] font-semibold tracking-tight text-zinc-900">
            Λογαριασμοί οδηγών
          </h3>
          <p className="mt-1 text-[14px] text-zinc-500 tracking-tight max-w-lg">
            Email και κωδικός για είσοδο στο /driver.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/admin/drivers/new')}
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-[12px] bg-zinc-900 text-white text-[14px] font-semibold hover:bg-zinc-800 transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Νέος λογαριασμός
        </button>
      </div>

      <div className="rounded-[22px] bg-white/80 backdrop-blur-xl border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-zinc-100/80">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[18px]">
              search
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Αναζήτηση ονόματος, email, πινακίδας…"
              className="w-full h-11 rounded-[12px] bg-zinc-50 border border-zinc-200/70 pl-10 pr-3 text-[14px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900/5"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-11 rounded-[12px] bg-zinc-50 border border-zinc-200/70 px-3.5 text-[14px] font-medium text-zinc-700 focus:outline-none focus:bg-white"
          >
            <option value="">Όλοι</option>
            <option value="active">Ενεργοί</option>
            <option value="on_leave">Άδεια</option>
            <option value="inactive">Ανενεργοί</option>
          </select>
          <a
            href="/driver"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-[12px] bg-zinc-100 text-zinc-800 text-[13px] font-semibold hover:bg-zinc-200/80 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            /driver
          </a>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-11 h-11 rounded-full bg-zinc-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-zinc-100 rounded-md w-36" />
                  <div className="h-3 bg-zinc-50 rounded-md w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="px-6 py-14 text-center">
            <div className="w-14 h-14 rounded-[16px] bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-amber-500 text-[28px]">wifi_off</span>
            </div>
            <p className="text-[16px] font-semibold text-zinc-800 tracking-tight">
              Δεν φορτώθηκε η λίστα οδηγών
            </p>
            <p className="text-[14px] text-zinc-500 mt-1 max-w-md mx-auto">{loadError}</p>
            <button
              type="button"
              onClick={() => load()}
              className="mt-5 inline-flex items-center gap-2 h-11 px-5 rounded-[12px] bg-zinc-900 text-white text-[14px] font-semibold"
            >
              Δοκιμή ξανά
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="w-14 h-14 rounded-[16px] bg-zinc-50 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-zinc-300 text-[28px]">badge</span>
            </div>
            <p className="text-[16px] font-semibold text-zinc-800 tracking-tight">
              {drivers.length === 0 ? 'Κανένας λογαριασμός ακόμα' : 'Κανένα αποτέλεσμα'}
            </p>
            <p className="text-[14px] text-zinc-500 mt-1">
              {drivers.length === 0
                ? 'Δημιουργήστε τον πρώτο οδηγό για την εφαρμογή.'
                : 'Δοκιμάστε άλλο φίλτρο ή αναζήτηση.'}
            </p>
            {drivers.length === 0 ? (
              <button
                type="button"
                onClick={() => navigate('/admin/drivers/new')}
                className="mt-5 inline-flex items-center gap-2 h-11 px-5 rounded-[12px] bg-zinc-900 text-white text-[14px] font-semibold"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                Νέος λογαριασμός
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100/90">
            {visible.map((d) => {
              const plate = d.license_plate || d.vehicle_code;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/drivers/${d.id}`)}
                    className="w-full text-left px-4 sm:px-5 py-3.5 flex items-center gap-3 sm:gap-4 hover:bg-zinc-50/80 transition-colors group"
                  >
                    {d.photo_url ? (
                      <img
                        src={resolveSiteAssetUrl(d.photo_url)}
                        alt=""
                        className="w-11 h-11 rounded-full object-cover shrink-0 ring-1 ring-black/5"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-zinc-100 text-zinc-600 font-semibold text-[13px] flex items-center justify-center shrink-0">
                        {driverInitials(d.name)}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-[15px] text-zinc-900 tracking-tight truncate">
                          {d.name}
                        </span>
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            STATUS_DOT[d.status] || STATUS_DOT.inactive
                          }`}
                          title={STATUS_LABELS[d.status] || d.status}
                        />
                      </div>
                      <div className="mt-0.5 text-[13px] text-zinc-500 truncate tracking-tight">
                        {d.email}
                        {plate ? ` · ${plate}` : ''}
                      </div>
                    </div>

                    <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0">
                      <span className={`text-[13px] font-semibold tabular-nums ${safetyTone(d.safety_score)}`}>
                        {d.safety_score}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {d.has_password ? 'App έτοιμο' : 'Χωρίς κωδικό'}
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0 opacity-60 group-hover:opacity-100">
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/drivers/${d.id}/edit`);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.stopPropagation();
                            navigate(`/admin/drivers/${d.id}/edit`);
                          }
                        }}
                        className="w-9 h-9 rounded-[10px] flex items-center justify-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                        title="Επεξεργασία"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(d);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.stopPropagation();
                            onDelete(d);
                          }
                        }}
                        className="w-9 h-9 rounded-[10px] flex items-center justify-center text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                        title="Διαγραφή"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </span>
                      <span className="material-symbols-outlined text-zinc-300 text-[20px] hidden sm:inline">
                        chevron_right
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
