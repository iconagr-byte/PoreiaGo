import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { fetchLoginAudits } from '../../services/platformApi.js';

const ACTOR_FILTERS = [
  { id: '', label: 'Όλοι' },
  { id: 'admin', label: 'Διαχειριστές' },
  { id: 'customer', label: 'Πελάτες' },
  { id: 'driver', label: 'Οδηγοί' },
];

const RESULT_FILTERS = [
  { id: '', label: 'Όλα' },
  { id: 'ok', label: 'Επιτυχία' },
  { id: 'fail', label: 'Αποτυχία' },
];

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('el-GR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function actorBadgeClass(type) {
  if (type === 'admin') return 'bg-primary/10 text-primary';
  if (type === 'driver') return 'bg-emerald-50 text-emerald-700';
  if (type === 'customer') return 'bg-sky-50 text-sky-700';
  return 'bg-gray-100 text-gray-600';
}

export default function LoginAuditPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actorType, setActorType] = useState('');
  const [result, setResult] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLoginAudits({
        limit: 150,
        actorType: actorType || undefined,
        success: result === 'ok' ? true : result === 'fail' ? false : undefined,
        q: query || undefined,
      });
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία φόρτωσης συνδέσεων');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [actorType, result, query]);

  useEffect(() => {
    load();
  }, [load]);

  const onSearch = (e) => {
    e.preventDefault();
    setQuery(q.trim());
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest rounded-[24px] border border-black/[0.06] p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
          <div>
            <h3 className="font-headline-sm font-bold text-on-surface flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary">login</span>
              Καταγραφές συνδέσεων
            </h3>
            <p className="text-sm text-on-surface-variant">
              Χρόνος, IP και συσκευή για διαχειριστές, πελάτες και οδηγούς (επιτυχείς &amp; αποτυχημένες).
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-bold hover:bg-gray-800"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Ανανέωση
          </button>
        </div>

        <form onSubmit={onSearch} className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Αναζήτηση email / όνομα / IP…"
            className="flex-1 rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-2xl bg-primary text-white text-sm font-bold hover:bg-primary/90"
          >
            Αναζήτηση
          </button>
        </form>

        <div className="flex flex-wrap gap-2 mb-5">
          {ACTOR_FILTERS.map((f) => (
            <button
              key={f.id || 'all'}
              type="button"
              onClick={() => setActorType(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                actorType === f.id
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="w-px bg-black/10 mx-1 hidden sm:inline-block" />
          {RESULT_FILTERS.map((f) => (
            <button
              key={f.id || 'all-result'}
              type="button"
              onClick={() => setResult(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                result === f.id
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-on-surface-variant py-8 text-center">Φόρτωση…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-on-surface-variant py-8 text-center">
            Δεν υπάρχουν καταγραφές ακόμα. Θα εμφανιστούν μετά την επόμενη σύνδεση.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-black/[0.05]">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="bg-surface-container-low/70 text-left text-[11px] uppercase tracking-wider text-on-surface-variant">
                  <th className="px-4 py-3 font-bold">Χρόνος</th>
                  <th className="px-4 py-3 font-bold">Τύπος</th>
                  <th className="px-4 py-3 font-bold">Χρήστης</th>
                  <th className="px-4 py-3 font-bold">Αποτέλεσμα</th>
                  <th className="px-4 py-3 font-bold">IP</th>
                  <th className="px-4 py-3 font-bold">Συσκευή</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-t border-black/[0.04] hover:bg-surface-container-lowest">
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums text-on-surface">
                      {formatWhen(row.at)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${actorBadgeClass(
                          row.actor_type,
                        )}`}
                      >
                        {row.actor_type_label || row.actor_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-on-surface">{row.identity || '—'}</div>
                      {row.actor_name ? (
                        <div className="text-xs text-on-surface-variant">{row.actor_name}</div>
                      ) : null}
                      {row.method && row.method !== 'password' ? (
                        <div className="text-[11px] text-gray-400 mt-0.5">{row.method}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {row.success ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs">
                          <span className="material-symbols-outlined text-[16px]">check_circle</span>
                          Επιτυχία
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700 font-bold text-xs">
                          <span className="material-symbols-outlined text-[16px]">cancel</span>
                          Αποτυχία
                        </span>
                      )}
                      {row.detail && !row.success ? (
                        <div className="text-[11px] text-rose-500/80 mt-0.5 max-w-[180px] truncate" title={row.detail}>
                          {row.detail}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-on-surface">{row.ip || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="text-on-surface font-medium">{row.device || '—'}</div>
                      {row.user_agent ? (
                        <div
                          className="text-[10px] text-gray-400 max-w-[220px] truncate"
                          title={row.user_agent}
                        >
                          {row.user_agent}
                        </div>
                      ) : null}
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
