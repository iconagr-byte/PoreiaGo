import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { isSaasSuperAdmin } from '../../lib/saasJwt.js';
import {
  fetchPlatformOverview,
  fetchPlatformTenants,
  impersonatePlatformTenant,
  reactivatePlatformTenant,
  reportPlatformUsageAll,
  suspendPlatformTenant,
} from '../../services/platformSaasApi.js';
import { getSaasToken, startImpersonationSession } from '../../services/saasApi.js';

const PLAN_BADGE = {
  starter: 'bg-slate-100 text-slate-700',
  professional: 'bg-indigo-100 text-indigo-800',
  enterprise: 'bg-violet-100 text-violet-800',
};

export default function SuperAdminPanel() {
  const [overview, setOverview] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async (query) => {
    if (!getSaasToken() || !isSaasSuperAdmin()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [ov, list] = await Promise.all([
        fetchPlatformOverview(),
        fetchPlatformTenants({ limit: 50, q: query || undefined }),
      ]);
      setOverview(ov);
      setTenants(list.items || []);
      setTotal(list.total ?? 0);
    } catch (e) {
      toast.error(e.message || 'Super Admin API απέτυχε');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load('');
  }, [load]);

  const runUsageJob = async () => {
    setWorking(true);
    try {
      const stats = await reportPlatformUsageAll(true);
      toast.success(
        `Usage: ${stats.reported} reported, ${stats.snapshots_only} snapshots only`,
      );
    } catch (e) {
      toast.error(e.message || 'Usage job απέτυχε');
    } finally {
      setWorking(false);
    }
  };

  const toggleTenant = async (tenant, suspend) => {
    setWorking(true);
    try {
      if (suspend) {
        await suspendPlatformTenant(tenant.id);
        toast.success(`Suspended: ${tenant.slug}`);
      } else {
        await reactivatePlatformTenant(tenant.id);
        toast.success(`Reactivated: ${tenant.slug}`);
      }
      load(search);
    } catch (e) {
      toast.error(e.message || 'Ενέργεια απέτυχε');
    } finally {
      setWorking(false);
    }
  };

  const impersonateTenant = async (tenant) => {
    setWorking(true);
    try {
      const tokenResponse = await impersonatePlatformTenant(tenant.id);
      startImpersonationSession(tokenResponse);
      toast.success(`Impersonation: ${tenant.slug}`);
      window.location.assign('/admin?tab=settings&sub=homepage');
    } catch (e) {
      toast.error(e.message || 'Impersonation απέτυχε');
    } finally {
      setWorking(false);
    }
  };

  const refreshTenants = () => load(search);

  if (!getSaasToken()) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-[24px] p-6 text-sm text-amber-900">
        Συνδεθείτε με JWT SaaS.
      </div>
    );
  }

  if (!isSaasSuperAdmin()) {
    return (
      <div className="bg-surface-container-low rounded-[24px] border p-6 text-sm text-on-surface-variant">
        <span className="material-symbols-outlined align-middle mr-2 text-gray-400">lock</span>
        Απαιτείται ρόλος <strong>superadmin</strong> στο JWT (μετά από seed / re-login).
      </div>
    );
  }

  const billing = overview?.billing;

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-6 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-1">
              Project PoreiaGo
            </p>
            <h3 className="text-xl font-bold">Super Admin Console</h3>
            <p className="text-sm text-slate-300 mt-1">
              Health: {overview?.health_status || '…'} · {total} tenants
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => load('')}
              disabled={loading}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20"
            >
              <span className="material-symbols-outlined">refresh</span>
            </button>
            <button
              type="button"
              onClick={runUsageJob}
              disabled={working}
              className="px-4 py-2 rounded-full bg-white text-slate-900 text-sm font-bold disabled:opacity-50"
            >
              Report usage
            </button>
          </div>
        </div>

        {loading && !billing ? (
          <div className="mt-6 h-20 bg-white/10 rounded-2xl animate-pulse" />
        ) : billing ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <Metric label="MRR" value={`€${billing.mrr_eur?.toFixed?.(2) ?? billing.mrr_eur}`} />
            <Metric label="Ενεργοί tenants" value={billing.active_tenants} />
            <Metric label="Trial" value={billing.trial_tenants} />
            <Metric label="Past due" value={billing.past_due_tenants} warn={billing.past_due_tenants > 0} />
          </div>
        ) : null}

        {overview && (
          <p className="text-xs text-slate-400 mt-4">
            {overview.total_users} users · {overview.total_bookings} bookings (platform-wide)
          </p>
        )}
      </div>

      <div className="bg-white rounded-[24px] border p-6 shadow-sm">
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Αναζήτηση slug / όνομα…"
            className="flex-1 min-w-[200px] px-4 py-2.5 rounded-2xl bg-gray-50 text-sm"
          />
          <button
            type="button"
            onClick={refreshTenants}
            className="px-4 py-2.5 rounded-full border text-sm font-bold"
          >
            Αναζήτηση
          </button>
        </div>

        {loading ? (
          <div className="h-32 bg-gray-50 rounded-2xl animate-pulse" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 border-b">
                  <th className="pb-3 pr-4">Tenant</th>
                  <th className="pb-3 pr-4">Plan</th>
                  <th className="pb-3 pr-4">Subscription</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Ενέργειες</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/80">
                    <td className="py-3 pr-4">
                      <div className="font-bold">{t.legal_name}</div>
                      <div className="text-xs text-gray-500 font-mono">{t.slug}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          PLAN_BADGE[t.plan] || PLAN_BADGE.starter
                        }`}
                      >
                        {t.plan}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-xs">
                      {t.subscription?.status || '—'}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          t.is_active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {t.is_active ? 'active' : 'suspended'}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2 items-center">
                        <button
                          type="button"
                          disabled={working || !t.is_active}
                          onClick={() => impersonateTenant(t)}
                          className="text-xs font-bold text-indigo-600 hover:underline disabled:opacity-50"
                          title="Login as tenant admin"
                        >
                          Login as
                        </button>
                        {t.is_active ? (
                          <button
                            type="button"
                            disabled={working}
                            onClick={() => toggleTenant(t, true)}
                            className="text-xs font-bold text-rose-600 hover:underline disabled:opacity-50"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={working}
                            onClick={() => toggleTenant(t, false)}
                            className="text-xs font-bold text-emerald-600 hover:underline disabled:opacity-50"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tenants.length === 0 && (
              <p className="text-center text-gray-500 py-8">Δεν βρέθηκαν tenants.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, warn }) {
  return (
    <div className={`rounded-2xl p-4 ${warn ? 'bg-amber-500/20' : 'bg-white/10'}`}>
      <div className="text-xs text-indigo-200 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
