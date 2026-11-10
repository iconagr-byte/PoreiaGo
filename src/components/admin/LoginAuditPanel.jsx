import { useCallback, useEffect, useMemo, useState } from 'react';
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
  if (type === 'admin') return 'bg-[#0071e3]/10 text-[#0071e3]';
  if (type === 'driver') return 'bg-emerald-500/10 text-emerald-700';
  if (type === 'customer') return 'bg-sky-500/10 text-sky-700';
  return 'bg-black/[0.05] text-[#6e6e73]';
}

function officeKeyFor(row) {
  return String(row?.tenant_id || '').trim() || '__none__';
}

function officeLabelFor(row) {
  return (
    row?.office_label ||
    [row?.tenant_name, row?.tenant_slug].filter(Boolean).join(' · ') ||
    (row?.tenant_id ? `Γραφείο ${String(row.tenant_id).slice(0, 8)}…` : 'Χωρίς γραφείο')
  );
}

export default function LoginAuditPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actorType, setActorType] = useState('driver');
  const [result, setResult] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [officeFilter, setOfficeFilter] = useState('');
  const [collapsedOffices, setCollapsedOffices] = useState(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLoginAudits({
        limit: 500,
        actorType: actorType || undefined,
        success: result === 'ok' ? true : result === 'fail' ? false : undefined,
        q: query || undefined,
      });
      setItems(Array.isArray(data.items) ? data.items : []);
      setOfficeFilter('');
      setCollapsedOffices(new Set());
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

  useEffect(() => {
    if (query.trim()) setCollapsedOffices(new Set());
  }, [query]);

  const officeOptions = useMemo(() => {
    const map = new Map();
    for (const row of items) {
      const key = officeKeyFor(row);
      if (!map.has(key)) {
        map.set(key, officeLabelFor(row));
      }
    }
    return [...map.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'el', { sensitivity: 'base' }));
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!officeFilter) return items;
    return items.filter((row) => officeKeyFor(row) === officeFilter);
  }, [items, officeFilter]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const row of filteredItems) {
      const key = officeKeyFor(row);
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: officeLabelFor(row),
          slug: row.tenant_slug || '',
          rows: [],
        });
      }
      map.get(key).rows.push(row);
    }
    return [...map.values()].sort((a, b) =>
      a.label.localeCompare(b.label, 'el', { sensitivity: 'base' }),
    );
  }, [filteredItems]);

  const toggleOffice = (key) => {
    setCollapsedOffices((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => setCollapsedOffices(new Set());
  const collapseAll = () => setCollapsedOffices(new Set(groups.map((g) => g.key)));

  const onSearch = (e) => {
    e.preventDefault();
    setQuery(q.trim());
  };

  const okCount = filteredItems.filter((r) => r.success).length;
  const failCount = filteredItems.length - okCount;

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-[24px] border border-black/[0.06] bg-gradient-to-br from-[#1d1d1f] via-[#2c2c2e] to-[#1d1d1f] p-6 text-white shadow-sm">
        <div
          className="pointer-events-none absolute -right-16 -top-12 h-48 w-48 rounded-full bg-[#0071e3]/25 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h3 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
              <span className="material-symbols-outlined text-[#64d2ff]">login</span>
              Καταγραφές συνδέσεων
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/70 tracking-tight">
              Ομαδοποιημένες ανά γραφείο — σύνδεση οδηγού (κωδικός ή Master QR), ώρα, IP και
              συσκευή. Χωρίς ειδοποιήσεις στον οδηγό.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold tabular-nums">
              {filteredItems.length} εγγραφές
            </span>
            <span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 tabular-nums">
              {okCount} επιτυχίες
            </span>
            <span className="rounded-full bg-rose-400/15 px-3 py-1.5 text-[11px] font-semibold text-rose-200 tabular-nums">
              {failCount} αποτυχίες
            </span>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold tracking-tight text-[#1d1d1f] hover:bg-white/90"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              Ανανέωση
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[22px] border border-black/[0.06] bg-white/90 p-4 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset] backdrop-blur sm:p-5">
        <form onSubmit={onSearch} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Αναζήτηση email / όνομα / IP / γραφείο…"
            className="flex-1 rounded-full border border-black/[0.08] bg-[#f5f5f7] px-4 py-2.5 text-sm tracking-tight text-[#1d1d1f] outline-none transition focus:border-[#0071e3]/40 focus:bg-white focus:ring-2 focus:ring-[#0071e3]/15"
          />
          <button
            type="submit"
            className="rounded-full bg-[#0071e3] px-5 py-2.5 text-sm font-semibold tracking-tight text-white hover:bg-[#0066cc]"
          >
            Αναζήτηση
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {ACTOR_FILTERS.map((f) => (
            <button
              key={f.id || 'all'}
              type="button"
              onClick={() => setActorType(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold tracking-tight transition ${
                actorType === f.id
                  ? 'bg-[#0071e3] text-white'
                  : 'bg-[#f5f5f7] text-[#6e6e73] hover:bg-[#ebebed]'
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="mx-1 hidden w-px self-stretch bg-black/10 sm:inline-block" />
          {RESULT_FILTERS.map((f) => (
            <button
              key={f.id || 'all-result'}
              type="button"
              onClick={() => setResult(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold tracking-tight transition ${
                result === f.id
                  ? 'bg-[#1d1d1f] text-white'
                  : 'bg-[#f5f5f7] text-[#6e6e73] hover:bg-[#ebebed]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {officeOptions.length > 0 ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] font-semibold tracking-tight text-[#86868b] sm:max-w-sm">
              Γραφείο
              <select
                value={officeFilter}
                onChange={(e) => setOfficeFilter(e.target.value)}
                className="rounded-full border border-black/[0.08] bg-[#f5f5f7] px-3 py-2 text-sm font-semibold tracking-tight text-[#1d1d1f] outline-none focus:border-[#0071e3]/40 focus:bg-white"
              >
                <option value="">Όλα τα γραφεία ({officeOptions.length})</option>
                {officeOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {groups.length > 1 ? (
              <div className="inline-flex rounded-full border border-black/[0.06] bg-[#f5f5f7] p-0.5 self-start sm:self-end">
                <button
                  type="button"
                  onClick={expandAll}
                  className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-[#1d1d1f] hover:bg-white"
                >
                  Άνοιγμα όλων
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-[#6e6e73] hover:bg-white"
                >
                  Κλείσιμο
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="rounded-[22px] border border-black/[0.06] bg-white p-10 text-center text-sm text-[#86868b]">
          Φόρτωση…
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-[22px] border border-black/[0.06] bg-white p-10 text-center text-sm text-[#6e6e73]">
          Δεν υπάρχουν καταγραφές ακόμα. Θα εμφανιστούν μετά την επόμενη σύνδεση.
        </div>
      ) : (
        <div className="grid gap-4">
          {groups.map((group) => {
            const isCollapsed = collapsedOffices.has(group.key);
            const groupOk = group.rows.filter((r) => r.success).length;
            const groupFail = group.rows.length - groupOk;
            return (
              <section
                key={group.key}
                className="overflow-hidden rounded-[22px] border border-black/[0.07] bg-white shadow-[0_8px_28px_rgba(15,23,42,0.045)]"
              >
                <button
                  type="button"
                  onClick={() => toggleOffice(group.key)}
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-center justify-between gap-3 border-b border-black/[0.05] bg-gradient-to-r from-[#f5f5f7] via-white to-white px-4 py-3.5 text-left transition hover:from-[#efeff2] sm:px-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#1d1d1f] text-white shadow-sm">
                      <span className="material-symbols-outlined text-[20px]">apartment</span>
                    </span>
                    <div className="min-w-0">
                      <h4 className="truncate text-[0.95rem] font-bold tracking-tight text-[#1d1d1f]">
                        {group.label}
                      </h4>
                      <p className="mt-0.5 truncate text-[11px] tracking-tight text-[#86868b]">
                        {groupOk} επιτυχ. · {groupFail} αποτ. · πάτα για{' '}
                        {isCollapsed ? 'άνοιγμα' : 'κλείσιμο'}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold tabular-nums tracking-tight text-[#1d1d1f] ring-1 ring-black/[0.06]">
                      {group.rows.length}{' '}
                      {group.rows.length === 1 ? 'σύνδεση' : 'συνδέσεις'}
                    </span>
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.04] text-[#6e6e73] transition ${
                        isCollapsed ? '' : 'rotate-180'
                      }`}
                      aria-hidden
                    >
                      <span className="material-symbols-outlined text-[20px]">expand_more</span>
                    </span>
                  </div>
                </button>

                {!isCollapsed ? (
                  <div className="overflow-x-auto bg-[#fafafa]">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="text-left text-[10px] font-semibold uppercase tracking-[0.04em] text-[#86868b]">
                          <th className="px-4 py-2.5 sm:px-5">Χρόνος</th>
                          <th className="px-3 py-2.5">Τύπος</th>
                          <th className="px-3 py-2.5">Χρήστης</th>
                          <th className="px-3 py-2.5">Αποτέλεσμα</th>
                          <th className="px-3 py-2.5">IP</th>
                          <th className="px-3 py-2.5 sm:pr-5">Συσκευή</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row) => (
                          <tr
                            key={row.id}
                            className="border-t border-black/[0.04] bg-white/80 transition hover:bg-white"
                          >
                            <td className="whitespace-nowrap px-4 py-3 tabular-nums tracking-tight text-[#1d1d1f] sm:px-5">
                              {formatWhen(row.at)}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${actorBadgeClass(
                                  row.actor_type,
                                )}`}
                              >
                                {row.actor_type_label || row.actor_type}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="font-semibold tracking-tight text-[#1d1d1f]">
                                {row.identity || '—'}
                              </div>
                              {row.actor_name ? (
                                <div className="text-xs tracking-tight text-[#6e6e73]">
                                  {row.actor_name}
                                </div>
                              ) : null}
                              {row.method && row.method !== 'password' ? (
                                <div className="mt-0.5 text-[11px] text-[#86868b]">{row.method}</div>
                              ) : null}
                            </td>
                            <td className="px-3 py-3">
                              {row.success ? (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                                  <span className="material-symbols-outlined text-[16px]">
                                    check_circle
                                  </span>
                                  Επιτυχία
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700">
                                  <span className="material-symbols-outlined text-[16px]">
                                    cancel
                                  </span>
                                  Αποτυχία
                                </span>
                              )}
                              {row.detail && !row.success ? (
                                <div
                                  className="mt-0.5 max-w-[180px] truncate text-[11px] text-rose-500/80"
                                  title={row.detail}
                                >
                                  {row.detail}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-3 py-3 font-mono text-xs text-[#1d1d1f]">
                              {row.ip || '—'}
                            </td>
                            <td className="px-3 py-3 sm:pr-5">
                              <div className="font-medium tracking-tight text-[#1d1d1f]">
                                {row.device || '—'}
                              </div>
                              {row.user_agent ? (
                                <div
                                  className="max-w-[220px] truncate text-[10px] text-[#86868b]"
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
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
