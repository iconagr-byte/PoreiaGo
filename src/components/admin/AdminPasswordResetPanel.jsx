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

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const rows = await fetchPlatformUsers();
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

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        String(u.name || '')
          .toLowerCase()
          .includes(q) ||
        String(u.email || '')
          .toLowerCase()
          .includes(q) ||
        String(u.role || '')
          .toLowerCase()
          .includes(q),
    );
  }, [users, query]);

  const activeCount = users.filter((u) => u.is_active).length;

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
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-[24px] border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Χρήστες τρέχοντος γραφείου</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Πάτα «Αποστολή» δίπλα στον χρήστη — θα λάβει email με σύνδεσμο.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
                search
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Αναζήτηση ονόματος / email…"
                className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
          </div>

          {loadingUsers ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-400">
              <span className="material-symbols-outlined animate-spin text-[20px]">
                progress_activity
              </span>
              Φόρτωση χρηστών…
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-10 text-center">
              <span className="material-symbols-outlined text-[36px] text-slate-300">
                person_off
              </span>
              <p className="mt-2 text-sm text-slate-500">
                {query ? 'Κανένα αποτέλεσμα για την αναζήτηση.' : 'Δεν βρέθηκαν χρήστες.'}
              </p>
              {!query ? (
                <button
                  type="button"
                  onClick={() => setMode('email')}
                  className="mt-3 text-sm font-bold text-sky-700 hover:underline"
                >
                  Στείλε με email αντί αυτού
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredUsers.map((u) => {
                const sending = busyKey === u.id;
                return (
                  <li
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-slate-50/80"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          u.is_active
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {initials(u.name, u.email)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 truncate">{u.name}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                            {ROLE_LABELS[u.role] || u.role || '—'}
                          </span>
                          {!u.is_active ? (
                            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                              Ανενεργός
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">{u.email}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={Boolean(busyKey) || !u.is_active}
                      onClick={() => setConfirmUser(u)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
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
                  <strong className="text-slate-800">{confirmUser.email}</strong> με σύνδεσμο
                  επαναφοράς κωδικού (λήξη σε 1 ώρα).
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
