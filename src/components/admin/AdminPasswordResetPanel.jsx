import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { isSaasSuperAdmin } from '../../lib/saasJwt.js';
import {
  sendAdminPasswordResetByEmail,
  sendPlatformUserPasswordReset,
  fetchPlatformUsers,
} from '../../services/platformApi.js';
import {
  fetchPlatformTenantOptions,
  formatPlatformTenantLabel,
} from '../../services/platformSaasApi.js';

const ROLE_LABELS = {
  admin: 'Διαχειριστής',
  driver: 'Οδηγός',
  agent: 'Πράκτορας',
  viewer: 'Ανάγνωση',
};

function initials(name, email) {
  const raw = String(name || email || '?').trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return raw.slice(0, 2).toUpperCase();
}

/**
 * Superadmin menu: send a one-hour password-reset link for office / platform accounts.
 */
export default function AdminPasswordResetPanel() {
  const superAdmin = isSaasSuperAdmin();
  const [mode, setMode] = useState('list'); // 'list' | 'email'
  const [email, setEmail] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [tenants, setTenants] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [busyKey, setBusyKey] = useState('');
  const [query, setQuery] = useState('');
  const [lastResult, setLastResult] = useState(null); // { email, at, resetUrl? }
  const [matches, setMatches] = useState([]);
  const [confirmUser, setConfirmUser] = useState(null);
  /** Office keys that are collapsed (users hidden). */
  const [collapsedOffices, setCollapsedOffices] = useState(() => new Set());

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const rows = await fetchPlatformUsers({ allOffices: true });
      setUsers(Array.isArray(rows) ? rows : []);
    } catch {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (!superAdmin) return;
    fetchPlatformTenantOptions({ limit: 100 })
      .then((rows) => setTenants(rows))
      .catch(() => setTenants([]));
    loadUsers();
  }, [superAdmin, loadUsers]);

  const tenantLabelById = useMemo(() => {
    const map = new Map();
    for (const t of tenants) {
      if (t?.id != null) map.set(String(t.id), formatPlatformTenantLabel(t));
    }
    return map;
  }, [tenants]);

  const officeLabelFor = useCallback(
    (u) => {
      if (!u) return 'Χωρίς γραφείο';
      const fromApi = [u.tenant_name, u.tenant_slug].filter(Boolean).join(' · ');
      if (fromApi) return fromApi;
      if (u.tenant_id && tenantLabelById.has(String(u.tenant_id))) {
        return tenantLabelById.get(String(u.tenant_id));
      }
      return u.tenant_id ? `Γραφείο ${String(u.tenant_id).slice(0, 8)}…` : 'Χωρίς γραφείο';
    },
    [tenantLabelById],
  );

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const office = officeLabelFor(u).toLowerCase();
      return (
        String(u.name || '')
          .toLowerCase()
          .includes(q) ||
        String(u.email || '')
          .toLowerCase()
          .includes(q) ||
        String(u.role || '')
          .toLowerCase()
          .includes(q) ||
        office.includes(q) ||
        String(u.tenant_slug || '')
          .toLowerCase()
          .includes(q)
      );
    });
  }, [users, query, officeLabelFor]);

  const usersByOffice = useMemo(() => {
    const groups = new Map();
    for (const u of filteredUsers) {
      const key = String(u.tenant_id || '__none__');
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: officeLabelFor(u),
          slug: u.tenant_slug || '',
          users: [],
        });
      }
      groups.get(key).users.push(u);
    }
    return [...groups.values()].sort((a, b) =>
      a.label.localeCompare(b.label, 'el', { sensitivity: 'base' }),
    );
  }, [filteredUsers, officeLabelFor]);

  const activeCount = users.filter((u) => u.is_active).length;
  const officeCount = useMemo(() => {
    const ids = new Set(users.map((u) => String(u.tenant_id || '')).filter(Boolean));
    return ids.size;
  }, [users]);

  // Searching: keep matching offices open so results stay visible.
  useEffect(() => {
    if (query.trim()) setCollapsedOffices(new Set());
  }, [query]);

  const toggleOffice = (key) => {
    setCollapsedOffices((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAllOffices = () => setCollapsedOffices(new Set());
  const collapseAllOffices = () =>
    setCollapsedOffices(new Set(usersByOffice.map((g) => g.key)));

  if (!superAdmin) {
    return (
      <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Μόνο superadmin πλατφόρμας μπορεί να στέλνει συνδέσμους επαναφοράς.
      </div>
    );
  }

  const markSent = (toEmail, resetUrl) => {
    setLastResult({
      email: toEmail,
      at: new Date().toISOString(),
      resetUrl: resetUrl || null,
    });
  };

  const onSendEmail = async (e) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    setBusyKey('email');
    setMatches([]);
    try {
      const res = await sendAdminPasswordResetByEmail({
        email: clean,
        tenantId: tenantId || undefined,
      });
      toast.success(res.message || 'Στάλθηκε το link');
      markSent(res.email || clean, res.reset_url);
      setEmail('');
    } catch (err) {
      const detail = err?.detail || err?.message;
      if (detail && typeof detail === 'object' && Array.isArray(detail.matches)) {
        setMatches(detail.matches);
        toast.error(detail.message || 'Επιλέξτε γραφείο');
      } else {
        toast.error(typeof detail === 'string' ? detail : err.message || 'Αποτυχία');
      }
    } finally {
      setBusyKey('');
    }
  };

  const onSendUser = async (u) => {
    setBusyKey(u.id);
    setConfirmUser(null);
    try {
      const res = await sendPlatformUserPasswordReset(u.id);
      toast.success(res.message || 'Στάλθηκε το link');
      markSent(u.email, res.reset_url);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία');
    } finally {
      setBusyKey('');
    }
  };

  const copyUrl = async (url) => {
    try {
      await navigator.clipboard?.writeText(url);
      toast.success('Ο σύνδεσμος αντιγράφηκε');
    } catch {
      toast.error('Αποτυχία αντιγραφής');
    }
  };

  return (
    <div className="space-y-5">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-sm">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-sky-500/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl"
          aria-hidden
        />
        <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/80">
              <span className="material-symbols-outlined text-[16px]">shield_lock</span>
              Ασφαλής επαναφορά
            </div>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight">Κωδικοί γραφείου</h2>
            <p className="mt-2 text-sm text-white/70 leading-relaxed">
              Στείλε σύνδεσμο επαναφοράς με email. Ισχύει για 1 ώρα και μόνο μία φορά μετά την αλλαγή
              κωδικού. Δεν αφορά πελάτες My Wallet.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
              <span className="material-symbols-outlined text-[16px]">schedule</span>
              Λήξη 1 ώρα
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
              <span className="material-symbols-outlined text-[16px]">done_all</span>
              Μία χρήση
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
              <span className="material-symbols-outlined text-[16px]">group</span>
              {activeCount} ενεργοί
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
              <span className="material-symbols-outlined text-[16px]">domain</span>
              {officeCount} γραφεία
            </span>
          </div>
        </div>
      </div>

      {/* Mode switch */}
      <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setMode('list')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition ${
            mode === 'list'
              ? 'bg-slate-900 text-white shadow'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">group</span>
          Από λίστα
        </button>
        <button
          type="button"
          onClick={() => setMode('email')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition ${
            mode === 'email'
              ? 'bg-slate-900 text-white shadow'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">mail</span>
          Με email
        </button>
      </div>

      {lastResult ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                <span className="material-symbols-outlined text-[22px]">mark_email_read</span>
              </span>
              <div className="min-w-0">
                <p className="font-bold text-emerald-950">Στάλθηκε σύνδεσμος</p>
                <p className="text-sm text-emerald-800/80 truncate mt-0.5">{lastResult.email}</p>
                <p className="text-[11px] text-emerald-700/70 mt-1">
                  {new Date(lastResult.at).toLocaleString('el-GR')} · ο παραλήπτης ανοίγει το email
                  και ορίζει νέο κωδικό
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLastResult(null)}
              className="text-xs font-bold text-emerald-800 hover:underline"
            >
              Κλείσιμο
            </button>
          </div>
          {lastResult.resetUrl ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-3">
              <p className="text-xs font-bold text-slate-600 mb-1">
                Εφεδρικός σύνδεσμος (το email απέτυχε)
              </p>
              <code className="block break-all text-[11px] text-slate-700 mb-2">
                {lastResult.resetUrl}
              </code>
              <button
                type="button"
                onClick={() => copyUrl(lastResult.resetUrl)}
                className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 hover:underline"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                Αντιγραφή συνδέσμου
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === 'email' ? (
        <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Αποστολή με email</h3>
            <p className="text-sm text-slate-500 mt-1">
              Χρήσιμο όταν ο λογαριασμός είναι σε άλλο γραφείο ή δεν εμφανίζεται στη λίστα.
            </p>
          </div>

          <form onSubmit={onSendEmail} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm min-w-0">
                <span className="font-bold text-slate-700">Email λογαριασμού</span>
                <div className="relative mt-1.5">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
                    alternate_email
                  </span>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3 pl-10 pr-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
                    placeholder="admin@office.com"
                    autoComplete="email"
                  />
                </div>
              </label>
              <label className="block text-sm min-w-0">
                <span className="font-bold text-slate-700">Γραφείο</span>
                <div className="relative mt-1.5">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
                    domain
                  </span>
                  <select
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50/50 py-3 pl-10 pr-9 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
                  >
                    <option value="">Αυτόματα / όλα</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {formatPlatformTenantLabel(t)}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
                    expand_more
                  </span>
                </div>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-[11px] text-slate-400 max-w-md">
                Αν το ίδιο email υπάρχει σε πολλά γραφεία, θα σου ζητηθεί να επιλέξεις ποιο.
              </p>
              <button
                type="submit"
                disabled={Boolean(busyKey) || !email.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {busyKey === 'email' ? 'progress_activity' : 'send'}
                </span>
                {busyKey === 'email' ? 'Αποστολή…' : 'Αποστολή συνδέσμου'}
              </button>
            </div>
          </form>

          {matches.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
              <p className="text-sm font-bold text-amber-950">
                Το email υπάρχει σε περισσότερα γραφεία — διάλεξε ένα:
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {matches.map((m) => (
                  <button
                    key={m.user_id}
                    type="button"
                    className="flex items-center gap-3 rounded-2xl border border-amber-200/80 bg-white px-3 py-3 text-left transition hover:border-slate-400 hover:shadow-sm"
                    onClick={() => {
                      setTenantId(m.tenant_id);
                      setMatches([]);
                      toast.success('Επιλέχθηκε γραφείο — πάτα ξανά Αποστολή');
                    }}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                      {initials(m.name, m.email)}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-bold text-slate-900 truncate">{m.name}</span>
                      <span className="block text-[11px] text-slate-500 truncate">
                        {m.email}
                      </span>
                      {m.tenant_id || m.tenant_name ? (
                        <span className="block text-[10px] font-bold text-slate-400 truncate mt-0.5">
                          {[m.tenant_name, m.tenant_slug].filter(Boolean).join(' · ') ||
                            tenantLabelById.get(String(m.tenant_id)) ||
                            `Γραφείο ${String(m.tenant_id).slice(0, 8)}…`}
                        </span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-[22px] border border-black/[0.06] bg-white/90 px-5 py-4 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset] backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-[1.05rem] font-bold tracking-tight text-[#1d1d1f]">
                  Χρήστες ανά γραφείο
                </h3>
                <p className="mt-0.5 text-[0.8125rem] tracking-tight text-[#6e6e73]">
                  Κάθε κάρτα = ένα γραφείο με τους χρήστες του · «Αποστολή link» για reset.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {usersByOffice.length > 1 ? (
                  <div className="inline-flex rounded-full border border-black/[0.06] bg-[#f5f5f7] p-0.5">
                    <button
                      type="button"
                      onClick={expandAllOffices}
                      className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-[#1d1d1f] hover:bg-white"
                    >
                      Άνοιγμα όλων
                    </button>
                    <button
                      type="button"
                      onClick={collapseAllOffices}
                      className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-[#6e6e73] hover:bg-white"
                    >
                      Κλείσιμο
                    </button>
                  </div>
                ) : null}
                <div className="relative w-full sm:w-72">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#86868b]">
                    search
                  </span>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Αναζήτηση ονόματος / email / γραφείου…"
                    className="w-full rounded-full border border-black/[0.08] bg-[#f5f5f7] py-2.5 pl-9 pr-3 text-sm tracking-tight text-[#1d1d1f] outline-none transition focus:border-[#0071e3]/40 focus:bg-white focus:ring-2 focus:ring-[#0071e3]/15"
                  />
                </div>
              </div>
            </div>
          </div>

          {loadingUsers ? (
            <div className="flex items-center justify-center gap-2 rounded-[22px] border border-black/[0.06] bg-white p-10 text-sm text-[#86868b]">
              <span className="material-symbols-outlined animate-spin text-[20px]">
                progress_activity
              </span>
              Φόρτωση χρηστών…
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="rounded-[22px] border border-black/[0.06] bg-white p-10 text-center">
              <span className="material-symbols-outlined text-[36px] text-[#c7c7cc]">
                person_off
              </span>
              <p className="mt-2 text-sm tracking-tight text-[#6e6e73]">
                {query ? 'Κανένα αποτέλεσμα για την αναζήτηση.' : 'Δεν βρέθηκαν χρήστες.'}
              </p>
              {!query ? (
                <button
                  type="button"
                  onClick={() => setMode('email')}
                  className="mt-3 text-sm font-semibold text-[#0071e3] hover:opacity-80"
                >
                  Στείλε με email αντί αυτού
                </button>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-4">
              {usersByOffice.map((group) => {
                const isCollapsed = collapsedOffices.has(group.key);
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
                            {group.slug && !group.label.includes(group.slug)
                              ? `${group.slug} · `
                              : ''}
                            Γραφείο · πάτα για {isCollapsed ? 'άνοιγμα' : 'κλείσιμο'}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold tabular-nums tracking-tight text-[#1d1d1f] ring-1 ring-black/[0.06]">
                          {group.users.length}{' '}
                          {group.users.length === 1 ? 'χρήστης' : 'χρήστες'}
                        </span>
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.04] text-[#6e6e73] transition ${
                            isCollapsed ? '' : 'rotate-180'
                          }`}
                          aria-hidden
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            expand_more
                          </span>
                        </span>
                      </div>
                    </button>

                    {!isCollapsed ? (
                      <ul className="divide-y divide-black/[0.04] bg-[#fafafa]">
                        {group.users.map((u) => {
                          const sending = busyKey === u.id;
                          const roleLabel = ROLE_LABELS[u.role] || u.role || '—';
                          const roleTone =
                            u.role === 'admin'
                              ? 'bg-[#0071e3]/10 text-[#0071e3]'
                              : u.role === 'driver'
                                ? 'bg-emerald-500/10 text-emerald-700'
                                : 'bg-black/[0.05] text-[#6e6e73]';
                          return (
                            <li
                              key={u.id}
                              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-white sm:px-5 sm:pl-7"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <span
                                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold tracking-tight ${
                                    u.is_active
                                      ? 'bg-[#1d1d1f] text-white'
                                      : 'bg-[#e8e8ed] text-[#86868b]'
                                  }`}
                                >
                                  {initials(u.name, u.email)}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="truncate font-semibold tracking-tight text-[#1d1d1f]">
                                      {u.name}
                                    </span>
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${roleTone}`}
                                    >
                                      {roleLabel}
                                    </span>
                                    {!u.is_active ? (
                                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                                        Ανενεργός
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-0.5 truncate text-xs tracking-tight text-[#6e6e73]">
                                    {u.email}
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={Boolean(busyKey) || !u.is_active}
                                onClick={() => setConfirmUser(u)}
                                className="inline-flex items-center gap-1.5 rounded-full bg-[#1d1d1f] px-3.5 py-2 text-xs font-semibold tracking-tight text-white transition hover:bg-black disabled:opacity-40"
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  {sending ? 'progress_activity' : 'lock_reset'}
                                </span>
                                {sending ? 'Αποστολή…' : 'Αποστολή link'}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirm dialog */}
      {confirmUser ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-confirm-title"
            className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
                <span className="material-symbols-outlined">mail</span>
              </span>
              <div>
                <h3 id="reset-confirm-title" className="text-lg font-bold text-slate-900">
                  Αποστολή reset link;
                </h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Θα σταλεί email στον{' '}
                  <strong className="text-slate-800">{confirmUser.email}</strong>
                  {confirmUser.tenant_id || confirmUser.tenant_name ? (
                    <>
                      {' '}
                      · γραφείο{' '}
                      <strong className="text-slate-800">{officeLabelFor(confirmUser)}</strong>
                    </>
                  ) : null}{' '}
                  με σύνδεσμο επαναφοράς κωδικού (λήξη σε 1 ώρα).
                </p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmUser(null)}
                className="rounded-full px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100"
              >
                Άκυρο
              </button>
              <button
                type="button"
                disabled={Boolean(busyKey)}
                onClick={() => onSendUser(confirmUser)}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                Ναι, αποστολή
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
