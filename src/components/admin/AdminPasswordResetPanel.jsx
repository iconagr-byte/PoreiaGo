import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { isSaasSuperAdmin } from '../../lib/saasJwt.js';
import {
  sendAdminPasswordResetByEmail,
  sendPlatformUserPasswordReset,
  fetchPlatformUsers,
} from '../../services/platformApi.js';
import { fetchPlatformTenants } from '../../services/platformSaasApi.js';

/**
 * Superadmin menu: send a one-hour password-reset link for office / platform accounts.
 */
export default function AdminPasswordResetPanel() {
  const superAdmin = isSaasSuperAdmin();
  const [email, setEmail] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [tenants, setTenants] = useState([]);
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [lastUrl, setLastUrl] = useState('');
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    if (!superAdmin) return;
    fetchPlatformTenants({ limit: 100 })
      .then((rows) => {
        if (Array.isArray(rows)) setTenants(rows);
        else if (Array.isArray(rows?.items)) setTenants(rows.items);
        else if (Array.isArray(rows?.tenants)) setTenants(rows.tenants);
        else setTenants([]);
      })
      .catch(() => setTenants([]));
    fetchPlatformUsers()
      .then((rows) => setUsers(Array.isArray(rows) ? rows : []))
      .catch(() => setUsers([]));
  }, [superAdmin]);

  if (!superAdmin) {
    return (
      <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Μόνο superadmin πλατφόρμας μπορεί να στέλνει συνδέσμους επαναφοράς.
      </div>
    );
  }

  const onSendEmail = async (e) => {
    e.preventDefault();
    setBusy(true);
    setLastUrl('');
    setMatches([]);
    try {
      const res = await sendAdminPasswordResetByEmail({
        email: email.trim().toLowerCase(),
        tenantId: tenantId || undefined,
      });
      toast.success(res.message || 'Στάλθηκε');
      if (res.reset_url) setLastUrl(res.reset_url);
    } catch (err) {
      const detail = err?.detail || err?.message;
      if (detail && typeof detail === 'object' && Array.isArray(detail.matches)) {
        setMatches(detail.matches);
        toast.error(detail.message || 'Επιλέξτε γραφείο');
      } else {
        toast.error(typeof detail === 'string' ? detail : err.message || 'Αποτυχία');
      }
    } finally {
      setBusy(false);
    }
  };

  const onSendUser = async (u) => {
    setBusy(true);
    setLastUrl('');
    try {
      const res = await sendPlatformUserPasswordReset(u.id);
      toast.success(res.message || 'Στάλθηκε');
      if (res.reset_url) setLastUrl(res.reset_url);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-[28px] text-slate-700">lock_reset</span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Επαναφορά κωδικού γραφείου</h2>
            <p className="text-sm text-slate-500 mt-1">
              Στέλνει email με σύνδεσμο 1 ώρας στο `/admin/reset-password` (HMAC, one-shot μετά την
              αλλαγή). Μόνο superadmin / διαχειριστής γραφείου. Δεν ισχύει για My Wallet πελατών.
            </p>
          </div>
        </div>

        <form onSubmit={onSendEmail} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
          <label className="block text-sm min-w-0">
            <span className="font-bold text-slate-700">Email λογαριασμού</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              placeholder="admin@office.com"
            />
          </label>
          <label className="block text-sm min-w-0">
            <span className="font-bold text-slate-700">Γραφείο (αν χρειάζεται)</span>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              <option value="">Αυτόματα / όλα</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.legal_name || t.name || t.slug || t.id}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
            {busy ? 'Αποστολή…' : 'Αποστολή link'}
          </button>
        </form>

        {matches.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm space-y-2">
            <p className="font-bold text-amber-900">Το email υπάρχει σε πολλά γραφεία — επιλέξτε:</p>
            {matches.map((m) => (
              <button
                key={m.user_id}
                type="button"
                className="block w-full text-left rounded-xl bg-white border px-3 py-2 hover:border-slate-400"
                onClick={() => {
                  setTenantId(m.tenant_id);
                  setMatches([]);
                }}
              >
                <span className="font-bold">{m.name}</span>
                <span className="text-slate-500 text-xs ml-2">{m.tenant_id}</span>
              </button>
            ))}
          </div>
        )}

        {lastUrl ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm space-y-2">
            <p className="font-bold text-sky-900">Σύνδεσμος (αντίγραφο αν το email απέτυχε)</p>
            <code className="block break-all text-xs text-sky-800">{lastUrl}</code>
            <button
              type="button"
              className="text-xs font-bold text-sky-700 hover:underline"
              onClick={() => {
                navigator.clipboard?.writeText(lastUrl);
                toast.success('Αντιγράφηκε');
              }}
            >
              Αντιγραφή
            </button>
          </div>
        ) : null}
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/80">
          <h3 className="font-bold text-slate-900">Χρήστες τρέχοντος γραφείου</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Γρήγορη αποστολή reset για όσους εμφανίζονται στο «Χρήστες».
          </p>
        </div>
        {users.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Δεν βρέθηκαν χρήστες σε αυτό το context.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 truncate">{u.name}</div>
                  <div className="text-xs text-slate-500 truncate">{u.email}</div>
                </div>
                <button
                  type="button"
                  disabled={busy || !u.is_active}
                  onClick={() => onSendUser(u)}
                  className="text-xs font-bold text-sky-700 hover:underline disabled:opacity-40"
                >
                  Αποστολή reset link
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
