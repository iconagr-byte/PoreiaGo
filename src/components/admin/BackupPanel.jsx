import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  createBackup,
  deleteBackup,
  downloadBackupFile,
  fetchBackups,
  restoreBackup,
} from '../../services/platformApi.js';
import { fetchPlatformTenants } from '../../services/platformSaasApi.js';
import {
  NAV_LAYOUT_STORAGE_KEY,
  NAV_ORDER_STORAGE_KEY,
} from '../../lib/admin/sidebarNav.js';
import { NAV_SERVICE_MODE_KEY } from '../../lib/admin/navServiceScope.js';
import { BUSES_HUB_ORDER_KEY } from '../../lib/admin/busesHub.js';

const SCOPES = [
  {
    id: 'office',
    title: 'Ανά γραφείο',
    icon: 'apartment',
    blurb: 'Εμφάνιση, μενού, πελάτες, εκδρομές, οδηγοί, πληρωμές — όλο το γραφείο.',
    accent: 'from-sky-600 to-cyan-700',
  },
  {
    id: 'platform',
    title: 'Πλατφόρμα',
    icon: 'hub',
    blurb: 'Ρυθμίσεις πλατφόρμας, telematics, χρήστες & οδηγοί όλων των γραφείων.',
    accent: 'from-slate-700 to-slate-900',
  },
    {
    id: 'database',
    title: 'Βάση δεδομένων',
    icon: 'database',
    blurb: 'Postgres dump — όλη η βάση ή μόνο ένα γραφείο. Μόνο λήψη.',
    accent: 'from-violet-700 to-indigo-900',
  },
];

const INCLUDE_LABELS = {
  tenant: 'Γραφείο',
  appearance: 'Εμφάνιση',
  admin_ui: 'Μενού',
  customers: 'Πελάτες',
  drivers: 'Οδηγοί',
  office_users: 'Χρήστες',
  trip_catalog: 'Εκδρομές',
  payment_settings: 'Πληρωμές',
  seat_pricing: 'Θέσεις',
  bookings: 'Κρατήσεις',
  platform_settings: 'Ρυθμίσεις',
  telemetry_settings: 'Telematics',
  users: 'Χρήστες',
  postgres_dump: 'Postgres (όλη)',
  postgres_office_dump: 'Postgres (γραφείο)',
};

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString('el-GR');
  } catch {
    return iso;
  }
}

function tenantLabel(t) {
  return t?.legal_name || t?.name || t?.slug || t?.id || '—';
}

function collectClientExtras() {
  const read = (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  return {
    nav_layout: read(NAV_LAYOUT_STORAGE_KEY) || read(`${NAV_LAYOUT_STORAGE_KEY}_super`),
    nav_order: read(NAV_ORDER_STORAGE_KEY) || read(`${NAV_ORDER_STORAGE_KEY}_super`),
    nav_service_mode: read(NAV_SERVICE_MODE_KEY),
    buses_hub_layout: read(BUSES_HUB_ORDER_KEY),
  };
}

function applyAdminUi(adminUi) {
  if (!adminUi || typeof adminUi !== 'object') return false;
  let applied = false;
  const write = (key, val) => {
    if (val == null || val === '') return;
    try {
      localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
      applied = true;
    } catch {
      /* ignore */
    }
  };
  write(NAV_LAYOUT_STORAGE_KEY, adminUi.nav_layout);
  write(NAV_ORDER_STORAGE_KEY, adminUi.nav_order);
  write(NAV_SERVICE_MODE_KEY, adminUi.nav_service_mode);
  write(BUSES_HUB_ORDER_KEY, adminUi.buses_hub_layout);
  return applied;
}

function ScopeBadge({ scope }) {
  const map = {
    office: { label: 'Γραφείο', cls: 'bg-sky-100 text-sky-800' },
    platform: { label: 'Πλατφόρμα', cls: 'bg-slate-200 text-slate-800' },
    database: { label: 'Βάση', cls: 'bg-violet-100 text-violet-800' },
  };
  const m = map[scope] || map.platform;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${m.cls}`}>
      {m.label}
    </span>
  );
}

export default function BackupPanel() {
  const [backups, setBackups] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [scope, setScope] = useState('office');
  const [tenantId, setTenantId] = useState('');
  const [dbMode, setDbMode] = useState('office'); // 'office' | 'full' — under database scope
  const [filter, setFilter] = useState('all'); // all | office | platform | database
  const [query, setQuery] = useState('');
  const [confirmRestore, setConfirmRestore] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setBackups(await fetchBackups());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    fetchPlatformTenants({ limit: 100 })
      .then((rows) => {
        if (Array.isArray(rows)) setTenants(rows);
        else if (Array.isArray(rows?.items)) setTenants(rows.items);
        else if (Array.isArray(rows?.tenants)) setTenants(rows.tenants);
        else setTenants([]);
      })
      .catch(() => setTenants([]));
  }, [load]);

  const filtered = useMemo(() => {
    let rows = backups;
    if (filter !== 'all') rows = rows.filter((b) => (b.scope || 'platform') === filter);
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (b) =>
          String(b.filename || '')
            .toLowerCase()
            .includes(q) ||
          String(b.tenant_label || '')
            .toLowerCase()
            .includes(q) ||
          (b.includes || []).join(',').toLowerCase().includes(q),
      );
    }
    return rows;
  }, [backups, filter, query]);

  const counts = useMemo(() => {
    const c = { all: backups.length, office: 0, platform: 0, database: 0 };
    for (const b of backups) {
      const s = b.scope || 'platform';
      if (c[s] != null) c[s] += 1;
    }
    return c;
  }, [backups]);

  const onCreate = async () => {
    const needsOffice =
      scope === 'office' || (scope === 'database' && dbMode === 'office');
    if (needsOffice && !tenantId) {
      toast.error('Επίλεξε γραφείο');
      return;
    }
    setWorking(true);
    try {
      const res = await createBackup({
        scope,
        tenantId: needsOffice ? tenantId : undefined,
        clientExtras: scope === 'office' ? collectClientExtras() : undefined,
      });
      toast.success(res.message || 'Backup OK');
      await load();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία');
    } finally {
      setWorking(false);
    }
  };

  const onRestore = async (b) => {
    setConfirmRestore(null);
    if (b.restorable === false || b.scope === 'database') {
      toast.error('Το database dump γίνεται μόνο λήψη — όχι restore από UI');
      return;
    }
    setWorking(true);
    try {
      const res = await restoreBackup(b.id);
      if (applyAdminUi(res.admin_ui)) {
        toast.success(`${res.message} · μενού εφαρμόστηκε σε αυτόν τον browser`);
      } else {
        toast.success(res.message || 'Επαναφορά OK');
      }
      await load();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία');
    } finally {
      setWorking(false);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm('Διαγραφή αυτού του backup;')) return;
    try {
      await deleteBackup(id);
      toast.success('Διαγράφηκε');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const activeScope = SCOPES.find((s) => s.id === scope) || SCOPES[0];

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white shadow-sm">
        <div
          className="pointer-events-none absolute -right-20 -top-16 h-56 w-56 rounded-full bg-sky-500/20 blur-3xl"
          aria-hidden
        />
        <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/80">
              <span className="material-symbols-outlined text-[16px]">cloud_done</span>
              Αντίγραφα ασφαλείας
            </div>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight">Backup</h2>
            <p className="mt-2 text-sm text-white/70 leading-relaxed">
              Ξεχωριστά snapshots ανά γραφείο (εμφάνιση, μενού, πελάτες…), backup πλατφόρμας, και
              πλήρες dump βάσης δεδομένων.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-white/10 px-3 py-1.5">{counts.office} γραφεία</span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">{counts.platform} πλατφόρμα</span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">{counts.database} DB</span>
          </div>
        </div>
      </div>

      {/* Create */}
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-5">
        <div>
          <h3 className="font-bold text-lg text-slate-900">Νέο αντίγραφο</h3>
          <p className="text-sm text-slate-500 mt-1">Διάλεξε τύπο και πάτα δημιουργία.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {SCOPES.map((s) => {
            const on = scope === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setScope(s.id)}
                className={`text-left rounded-2xl border p-4 transition ${
                  on
                    ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                    : 'border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <span
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${
                    on ? 'bg-white/15' : 'bg-white border border-slate-200'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[20px] ${on ? '' : 'text-slate-700'}`}>
                    {s.icon}
                  </span>
                </span>
                <div className={`mt-3 font-bold ${on ? 'text-white' : 'text-slate-900'}`}>{s.title}</div>
                <p className={`mt-1 text-xs leading-relaxed ${on ? 'text-white/70' : 'text-slate-500'}`}>
                  {s.blurb}
                </p>
              </button>
            );
          })}
        </div>

        {scope === 'database' ? (
          <div className="space-y-3">
            <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1 text-sm font-bold">
              <button
                type="button"
                onClick={() => setDbMode('office')}
                className={`rounded-xl px-4 py-2 transition ${
                  dbMode === 'office' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-white'
                }`}
              >
                Ανά γραφείο
              </button>
              <button
                type="button"
                onClick={() => setDbMode('full')}
                className={`rounded-xl px-4 py-2 transition ${
                  dbMode === 'full' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-white'
                }`}
              >
                Όλη η βάση
              </button>
            </div>
            <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
              {dbMode === 'office' ? (
                <>
                  Δημιουργεί <strong>Postgres dump ενός γραφείου</strong> (φίλτρο{' '}
                  <code className="text-xs bg-white/80 px-1 rounded">tenant_id</code>). Η επαναφορά γίνεται
                  μόνο στον server με <code className="text-xs bg-white/80 px-1 rounded">pg_restore</code>.
                </>
              ) : (
                <>
                  Δημιουργεί <strong>πλήρες Postgres dump</strong> όλης της πλατφόρμας. Η επαναφορά γίνεται μόνο
                  στον server με <code className="text-xs bg-white/80 px-1 rounded">pg_restore</code> — όχι από
                  αυτό το μενού.
                </>
              )}
            </div>
          </div>
        ) : null}

        {scope === 'office' || (scope === 'database' && dbMode === 'office') ? (
          <label className="block text-sm max-w-md">
            <span className="font-bold text-slate-700">Γραφείο</span>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
            >
              <option value="">— Επίλεξε γραφείο —</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {tenantLabel(t)}
                </option>
              ))}
            </select>
            {scope === 'office' ? (
              <p className="mt-1.5 text-[11px] text-slate-400">
                Περιλαμβάνει εμφάνιση, μενού (από αυτόν τον browser), πελάτες, εκδρομές, οδηγούς,
                πληρωμές, θέσεις, κρατήσεις (JSON — επαναφέρεται από το UI).
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] text-slate-400">
                Postgres dump μόνο για τις γραμμές αυτού του γραφείου (bookings, users, rentals…).
                Μόνο λήψη — restore με pg_restore στον server.
              </p>
            )}
          </label>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-slate-400 max-w-md">{activeScope.blurb}</p>
          <button
            type="button"
            disabled={
              working ||
              (scope === 'office' && !tenantId) ||
              (scope === 'database' && dbMode === 'office' && !tenantId)
            }
            onClick={onCreate}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">
              {working ? 'progress_activity' : 'cloud_upload'}
            </span>
            {working ? 'Δημιουργία…' : 'Δημιουργία backup'}
          </button>
        </div>
      </div>

      {/* History */}
      <div className="rounded-[24px] border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Ιστορικό</h3>
            <p className="text-xs text-slate-500 mt-0.5">Λήψη · επαναφορά (JSON) · διαγραφή</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-xs font-bold">
              {[
                ['all', 'Όλα'],
                ['office', 'Γραφεία'],
                ['platform', 'Πλατφόρμα'],
                ['database', 'DB'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`rounded-full px-3 py-1.5 transition ${
                    filter === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {label} {counts[id] ?? ''}
                </button>
              ))}
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
                search
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Αναζήτηση…"
                className="w-40 rounded-full border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-400">
            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
            Φόρτωση…
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">Δεν υπάρχουν backups ακόμα.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((b) => {
              const canRestore = b.restorable !== false && b.scope !== 'database';
              return (
                <li
                  key={b.id}
                  className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/70 transition"
                >
                  <div className="min-w-0 flex items-start gap-3">
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <span className="material-symbols-outlined text-[22px]">
                        {b.scope === 'database' ? 'database' : b.scope === 'office' ? 'apartment' : 'hub'}
                      </span>
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-900 truncate">
                          {b.filename}
                        </span>
                        <ScopeBadge scope={b.scope || 'platform'} />
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {formatDate(b.created_at)} · {formatSize(b.size_bytes)}
                        {b.tenant_label ? ` · ${b.tenant_label}` : ''}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(b.includes || []).slice(0, 8).map((inc) => (
                          <span
                            key={inc}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600"
                          >
                            {INCLUDE_LABELS[inc] || inc}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => downloadBackupFile(b.id, b.filename)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold hover:bg-slate-50"
                    >
                      <span className="material-symbols-outlined text-[14px]">download</span>
                      Λήψη
                    </button>
                    {canRestore ? (
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => setConfirmRestore(b)}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[14px]">restore</span>
                        Επαναφορά
                      </button>
                    ) : (
                      <span className="inline-flex items-center rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 bg-violet-50">
                        Μόνο λήψη
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onDelete(b.id)}
                      className="rounded-full px-3 py-1.5 text-xs font-bold text-rose-600 hover:underline"
                    >
                      Διαγραφή
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {confirmRestore ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
                <span className="material-symbols-outlined">warning</span>
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Επαναφορά backup;</h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Θα αντικατασταθούν δεδομένα από{' '}
                  <strong className="text-slate-800 font-mono text-xs">{confirmRestore.filename}</strong>
                  {confirmRestore.tenant_label ? (
                    <>
                      {' '}
                      για το γραφείο <strong>{confirmRestore.tenant_label}</strong>
                    </>
                  ) : null}
                  . Η ενέργεια δεν αναιρείται εύκολα.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmRestore(null)}
                className="rounded-full px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100"
              >
                Άκυρο
              </button>
              <button
                type="button"
                disabled={working}
                onClick={() => onRestore(confirmRestore)}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">restore</span>
                Ναι, επαναφορά
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
