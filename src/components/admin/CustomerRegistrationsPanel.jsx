import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { fetchWalletRegistrations } from '../../services/officeCustomersApi.js';

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('el-GR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function providerLabel(provider) {
  if (provider === 'google') return 'Google';
  return 'Email & κωδικός';
}

function initials(name, email) {
  const raw = String(name || email || '?').trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return raw.slice(0, 2).toUpperCase();
}

/**
 * Office-common list of My Wallet signups (buses + rent account).
 * Distinct from CRM «Πελάτες» (booking people).
 */
export default function CustomerRegistrationsPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchWalletRegistrations();
      setItems(rows);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία φόρτωσης εγγραφών');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((row) => {
      const hay = [row.name, row.email, row.customer_id, row.auth_provider]
        .map((v) => String(v || '').toLowerCase())
        .join(' ');
      return hay.includes(needle);
    });
  }, [items, q]);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-sky-600/90 mb-1">
            Γραφείο · κοινό
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Εγγραφές πελατών
          </h1>
          <p className="mt-1 text-sm text-slate-500 max-w-xl">
            Λογαριασμοί My Wallet που σφραγίστηκαν σε αυτό το γραφείο — κοινή λίστα για
            λεωφορεία και ενοικιάσεις.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Ανανέωση
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Σύνολο</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{items.length}</p>
        </div>
        <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Google</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {items.filter((r) => r.auth_provider === 'google').length}
          </p>
        </div>
        <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Email</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {items.filter((r) => r.auth_provider !== 'google').length}
          </p>
        </div>
      </div>

      <div className="rounded-[24px] border border-black/[0.06] bg-white shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-black/[0.05] flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
              search
            </span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Αναζήτηση ονόματος / email…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-400"
            />
          </div>
          <p className="text-xs font-semibold text-slate-400">
            {filtered.length} από {items.length}
          </p>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Φόρτωση…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300">person_add</span>
            <p className="mt-3 font-bold text-slate-800">Δεν υπάρχουν εγγραφές ακόμη</p>
            <p className="mt-1 text-sm text-slate-500">
              Όταν κάποιος κάνει εγγραφή στο My Wallet για το γραφείο σας, εμφανίζεται εδώ.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-black/[0.05]">
                  <th className="px-5 py-3">Πελάτης</th>
                  <th className="px-5 py-3">Επικοινωνία</th>
                  <th className="px-5 py-3">Μέθοδος</th>
                  <th className="px-5 py-3">Εγγραφή</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.email || row.customer_id}
                    className="border-b border-black/[0.04] last:border-0 hover:bg-slate-50/80"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                          {initials(row.name, row.email)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{row.name || '—'}</p>
                          <p className="text-xs text-slate-400 truncate">{row.customer_id || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-slate-800 truncate">{row.email}</p>
                      <p className="text-xs text-slate-400">{row.phone || '—'}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                          row.auth_provider === 'google'
                            ? 'bg-sky-50 text-sky-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {row.auth_provider === 'google' ? 'login' : 'mail'}
                        </span>
                        {providerLabel(row.auth_provider)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                      {formatWhen(row.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
