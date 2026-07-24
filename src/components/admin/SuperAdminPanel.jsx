import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { isSaasSuperAdmin } from '../../lib/saasJwt.js';
import {
  createPlatformTenant,
  fetchPlatformOverview,
  fetchPlatformTenants,
  impersonatePlatformTenant,
  reactivatePlatformTenant,
  reportPlatformUsageAll,
  suspendPlatformTenant,
  updatePlatformTenant,
} from '../../services/platformSaasApi.js';
import { getSaasToken, startImpersonationSession } from '../../services/saasApi.js';

const PLAN_META = {
  starter: {
    label: 'Starter',
    chip: 'bg-sky-100 text-sky-800 border-sky-200',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  professional: {
    label: 'Professional',
    chip: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    accent: 'from-indigo-50 to-white border-indigo-100',
  },
  enterprise: {
    label: 'Enterprise',
    chip: 'bg-teal-100 text-teal-800 border-teal-200',
    accent: 'from-teal-50 to-white border-teal-100',
  },
};

const SUB_META = {
  trialing: { label: 'Trial', chip: 'bg-amber-100 text-amber-800' },
  active: { label: 'Active', chip: 'bg-emerald-100 text-emerald-800' },
  past_due: { label: 'Past due', chip: 'bg-rose-100 text-rose-800' },
  canceled: { label: 'Canceled', chip: 'bg-slate-100 text-slate-600' },
  unpaid: { label: 'Unpaid', chip: 'bg-rose-100 text-rose-800' },
};

const EMPTY_CREATE = {
  legal_name: '',
  slug: '',
  subdomain: '',
  plan: 'starter',
  vat_number: '',
  admin_full_name: '',
  admin_email: '',
  admin_password: '',
};

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function formatDate(iso) {
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
    return '—';
  }
}

function isRecent(iso, days = 7) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < days * 24 * 60 * 60 * 1000;
}

function officeHost(tenant) {
  if (tenant.custom_domain) return tenant.custom_domain;
  if (tenant.subdomain) return `${tenant.subdomain}.poreiago.com`;
  return null;
}

function copyText(text) {
  if (!text) return;
  navigator.clipboard?.writeText(text).then(
    () => toast.success('Αντιγράφηκε'),
    () => toast.error('Αποτυχία αντιγραφής'),
  );
}

export default function SuperAdminPanel() {
  const [overview, setOverview] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [view, setView] = useState('table');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [slugTouched, setSlugTouched] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({
    legal_name: '',
    plan: 'starter',
    vat_number: '',
    custom_domain: '',
  });

  const load = useCallback(async ({ q = search, plan = planFilter, status = statusFilter } = {}) => {
    if (!getSaasToken() || !isSaasSuperAdmin()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = { limit: 100, q: q || undefined };
      if (plan !== 'all') params.plan = plan;
      if (status === 'active') params.isActive = true;
      if (status === 'suspended') params.isActive = false;
      const [ov, list] = await Promise.all([
        fetchPlatformOverview(),
        fetchPlatformTenants(params),
      ]);
      let items = list.items || [];
      if (status === 'trial') {
        items = items.filter((t) => String(t.subscription?.status || '').toLowerCase() === 'trialing');
      }
      setOverview(ov);
      setTenants(items);
      setTotal(list.total ?? items.length);
    } catch (e) {
      toast.error(e.message || 'Αποτυχία φόρτωσης γραφείων');
    } finally {
      setLoading(false);
    }
  }, [search, planFilter, statusFilter]);

  useEffect(() => {
    load({});
  }, [load]);

  const recentOffices = useMemo(() => {
    const fromOverview = Array.isArray(overview?.recent_tenants) ? overview.recent_tenants : [];
    if (fromOverview.length) return fromOverview.slice(0, 6);
    return tenants.filter((t) => isRecent(t.created_at)).slice(0, 6);
  }, [overview, tenants]);

  const counts = useMemo(() => {
    const active = tenants.filter((t) => t.is_active).length;
    const suspended = tenants.filter((t) => !t.is_active).length;
    const trial = tenants.filter((t) => String(t.subscription?.status || '').toLowerCase() === 'trialing').length;
    return { active, suspended, trial, shown: tenants.length };
  }, [tenants]);

  const runUsageJob = async () => {
    setWorking(true);
    try {
      const stats = await reportPlatformUsageAll(true);
      toast.success(`Usage: ${stats.reported} reported, ${stats.snapshots_only} snapshots only`);
    } catch (e) {
      toast.error(e.message || 'Usage job απέτυχε');
    } finally {
      setWorking(false);
    }
  };

  const toggleTenant = async (tenant, suspend) => {
    if (suspend && !window.confirm(`Αναστολή του «${tenant.legal_name || tenant.slug}»;`)) return;
    setWorking(true);
    try {
      if (suspend) {
        await suspendPlatformTenant(tenant.id);
        toast.success(`Αναστολή: ${tenant.legal_name || tenant.slug}`);
      } else {
        await reactivatePlatformTenant(tenant.id);
        toast.success(`Επανενεργοποίηση: ${tenant.legal_name || tenant.slug}`);
      }
      load();
    } catch (e) {
      toast.error(e.message || 'Η ενέργεια απέτυχε');
    } finally {
      setWorking(false);
    }
  };

  const openAsOffice = async (tenant) => {
    setWorking(true);
    try {
      const tokenResponse = await impersonatePlatformTenant(tenant.id);
      startImpersonationSession(tokenResponse);
      toast.success(`Άνοιγμα ως: ${tenant.legal_name || tenant.slug}`);
      window.location.assign('/admin?tab=dashboard');
    } catch (e) {
      toast.error(e.message || 'Αποτυχία εισόδου στο γραφείο');
    } finally {
      setWorking(false);
    }
  };

  const onCreateNameChange = (legalName) => {
    const next = { ...createForm, legal_name: legalName };
    if (!slugTouched) {
      const s = slugify(legalName);
      next.slug = s;
      next.subdomain = s;
    }
    setCreateForm(next);
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    setWorking(true);
    try {
      const payload = {
        legal_name: createForm.legal_name.trim(),
        slug: createForm.slug.trim().toLowerCase(),
        subdomain: (createForm.subdomain || createForm.slug).trim().toLowerCase(),
        plan: createForm.plan,
        vat_number: createForm.vat_number.trim() || null,
        admin_full_name: createForm.admin_full_name.trim(),
        admin_email: createForm.admin_email.trim().toLowerCase(),
        admin_password: createForm.admin_password,
      };
      const result = await createPlatformTenant(payload);
      toast.success(`Δημιουργήθηκε: ${result.tenant?.legal_name || payload.legal_name}`);
      setShowCreate(false);
      setCreateForm(EMPTY_CREATE);
      setSlugTouched(false);
      load();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία δημιουργίας γραφείου');
    } finally {
      setWorking(false);
    }
  };

  const openEdit = (tenant) => {
    setEditing(tenant);
    setEditForm({
      legal_name: tenant.legal_name || '',
      plan: tenant.plan || 'starter',
      vat_number: tenant.vat_number || '',
      custom_domain: tenant.custom_domain || '',
    });
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    setWorking(true);
    try {
      await updatePlatformTenant(editing.id, {
        legal_name: editForm.legal_name.trim(),
        plan: editForm.plan,
        vat_number: editForm.vat_number.trim() || null,
        custom_domain: editForm.custom_domain.trim() || null,
      });
      toast.success('Το γραφείο ενημερώθηκε');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία ενημέρωσης');
    } finally {
      setWorking(false);
    }
  };

  if (!getSaasToken()) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-[28px] p-6 text-sm text-amber-900">
        Συνδεθείτε με λογαριασμό πλατφόρμας (superadmin).
      </div>
    );
  }

  if (!isSaasSuperAdmin()) {
    return (
      <div className="bg-surface-container-low rounded-[28px] border p-6 text-sm text-on-surface-variant">
        <span className="material-symbols-outlined align-middle mr-2 text-gray-400">lock</span>
        Απαιτείται ρόλος <strong>superadmin</strong> για τη διαχείριση γραφείων.
      </div>
    );
  }

  const billing = overview?.billing;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-8">
      <section className="relative overflow-hidden rounded-[32px] border border-sky-100/80 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 text-white p-5 sm:p-6 shadow-[0_16px_48px_rgba(15,23,42,0.25)]">
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-sky-400/20 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-16 left-1/4 h-40 w-40 rounded-full bg-teal-400/15 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-teal-500 text-white shadow-lg shadow-sky-500/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                domain
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sky-200/90 text-[11px] font-bold uppercase tracking-widest mb-1">
                Πλατφόρμα PoreiaGo
              </p>
              <h3 className="text-2xl font-bold tracking-tight">Διαχείριση Γραφείων</h3>
              <p className="text-sm text-slate-300 mt-1">
                Signup + χειροκίνητα γραφεία · {total} συνολικά
                {overview ? ` · ${overview.total_users} χρήστες · ${overview.total_bookings} κρατήσεις` : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => load()}
              disabled={loading}
              className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
              title="Ανανέωση"
            >
              <span className="material-symbols-outlined">refresh</span>
            </button>
            <button
              type="button"
              onClick={runUsageJob}
              disabled={working}
              className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-sm font-bold disabled:opacity-50"
            >
              Report usage
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="px-4 py-2.5 rounded-full bg-white text-slate-900 text-sm font-bold inline-flex items-center gap-1.5 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Νέο γραφείο
            </button>
          </div>
        </div>

        {loading && !billing ? (
          <div className="mt-6 h-24 bg-white/10 rounded-2xl animate-pulse" />
        ) : billing ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            <Metric
              label="MRR"
              value={`€${billing.mrr_eur?.toFixed?.(2) ?? billing.mrr_eur}`}
              icon="payments"
            />
            <Metric label="Ενεργά" value={billing.active_tenants} icon="storefront" />
            <Metric label="Trial" value={billing.trial_tenants} icon="hourglass_top" />
            <Metric
              label="Past due"
              value={billing.past_due_tenants}
              icon="warning"
              warn={billing.past_due_tenants > 0}
            />
          </div>
        ) : null}
      </section>

      {recentOffices.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-sky-600">history</span>
              Πρόσφατα γραφεία
            </h4>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              τελευταίες εγγραφές
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {recentOffices.map((t) => {
              const plan = PLAN_META[t.plan] || PLAN_META.starter;
              const host = officeHost(t);
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={working || t.is_active === false}
                  onClick={() => openAsOffice(t)}
                  className={`text-left rounded-[24px] border bg-gradient-to-br p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-50 ${plan.accent}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-sky-500/20">
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                        storefront
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 truncate">{t.legal_name || t.slug}</p>
                        {isRecent(t.created_at) && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            ΝΕΟ
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono truncate mt-0.5">{t.slug}</p>
                      {host && <p className="text-[11px] text-slate-400 truncate mt-0.5">{host}</p>}
                      <span className={`inline-flex mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold border ${plan.chip}`}>
                        {plan.label}
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-slate-400">arrow_forward</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-[28px] border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
            <div className="flex flex-1 gap-2 min-w-0">
              <div className="relative flex-1 min-w-[12rem]">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                  search
                </span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && load({ q: search })}
                  placeholder="Αναζήτηση ονόματος ή slug…"
                  className="w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>
              <button
                type="button"
                onClick={() => load({ q: search })}
                className="px-4 py-2.5 rounded-full bg-slate-900 text-white text-sm font-bold shrink-0"
              >
                Αναζήτηση
              </button>
            </div>
            <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5 self-start">
              {[
                { id: 'table', icon: 'table_rows', label: 'Πίνακας' },
                { id: 'cards', icon: 'grid_view', label: 'Κάρτες' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setView(opt.id)}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ${
                    view === opt.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: `Όλα (${counts.shown})` },
              { id: 'active', label: `Ενεργά (${counts.active})` },
              { id: 'trial', label: `Trial (${counts.trial})` },
              { id: 'suspended', label: `Αναστολή (${counts.suspended})` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold border ${
                  statusFilter === f.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
            <span className="w-px h-6 bg-slate-200 self-center mx-1 hidden sm:block" />
            {['all', 'starter', 'professional', 'enterprise'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlanFilter(p)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold border ${
                  planFilter === p
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {p === 'all' ? 'Όλα τα πλάνα' : PLAN_META[p]?.label || p}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-5 grid gap-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : tenants.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[28px]">domain_disabled</span>
            </div>
            <p className="font-bold text-slate-900">Δεν βρέθηκαν γραφεία</p>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Δημιούργησε ένα ή περίμενε signup από <code className="text-xs bg-slate-100 px-1 rounded">/grafeia/signup</code>.
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-4 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-bold"
            >
              + Νέο γραφείο
            </button>
          </div>
        ) : view === 'cards' ? (
          <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            {tenants.map((t) => (
              <TenantCard
                key={t.id}
                tenant={t}
                working={working}
                onOpen={() => openAsOffice(t)}
                onEdit={() => openEdit(t)}
                onToggle={() => toggleTenant(t, t.is_active)}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100 bg-slate-50/80">
                  <th className="px-5 py-3 font-bold">Γραφείο</th>
                  <th className="px-3 py-3 font-bold">Πλάνο</th>
                  <th className="px-3 py-3 font-bold">Συνδρομή</th>
                  <th className="px-3 py-3 font-bold">Κατάσταση</th>
                  <th className="px-3 py-3 font-bold">Δημιουργία</th>
                  <th className="px-5 py-3 font-bold text-right">Ενέργειες</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenants.map((t) => {
                  const plan = PLAN_META[t.plan] || PLAN_META.starter;
                  const subKey = String(t.subscription?.status || '').toLowerCase();
                  const sub = SUB_META[subKey] || { label: t.subscription?.status || '—', chip: 'bg-slate-100 text-slate-600' };
                  const host = officeHost(t);
                  return (
                    <tr key={t.id} className="hover:bg-sky-50/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-100 to-teal-50 text-sky-700 flex items-center justify-center shrink-0 border border-sky-100">
                            <span className="material-symbols-outlined text-[20px]">storefront</span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 truncate">{t.legal_name}</span>
                              {isRecent(t.created_at) && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  ΝΕΟ
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono truncate">{t.slug}</div>
                            {host && (
                              <button
                                type="button"
                                onClick={() => copyText(host)}
                                className="text-[11px] text-sky-700 hover:underline truncate max-w-full"
                                title="Αντιγραφή URL"
                              >
                                {host}
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${plan.chip}`}>
                          {plan.label}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${sub.chip}`}>
                          {sub.label}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            t.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {t.is_active ? 'ενεργό' : 'σε αναστολή'}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(t.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <ActionBtn
                            disabled={working || !t.is_active}
                            onClick={() => openAsOffice(t)}
                            tone="primary"
                            icon="login"
                            label="Άνοιγμα"
                          />
                          <ActionBtn
                            disabled={working}
                            onClick={() => openEdit(t)}
                            tone="neutral"
                            icon="edit"
                            label="Επεξεργασία"
                          />
                          {t.is_active ? (
                            <ActionBtn
                              disabled={working}
                              onClick={() => toggleTenant(t, true)}
                              tone="danger"
                              icon="block"
                              label="Αναστολή"
                            />
                          ) : (
                            <ActionBtn
                              disabled={working}
                              onClick={() => toggleTenant(t, false)}
                              tone="success"
                              icon="check_circle"
                              label="Επανενεργοποίηση"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showCreate && (
        <Modal title="Νέο γραφείο" onClose={() => !working && setShowCreate(false)}>
          <form onSubmit={submitCreate} className="space-y-4">
            <Field label="Επωνυμία" value={createForm.legal_name} onChange={onCreateNameChange} required />
            <div className="grid sm:grid-cols-2 gap-3">
              <Field
                label="Slug"
                value={createForm.slug}
                onChange={(v) => {
                  setSlugTouched(true);
                  setCreateForm((f) => ({ ...f, slug: slugify(v), subdomain: slugify(v) }));
                }}
                required
              />
              <Field
                label="Subdomain"
                value={createForm.subdomain}
                onChange={(v) => setCreateForm((f) => ({ ...f, subdomain: slugify(v) }))}
                required
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="font-bold text-slate-500">Πλάνο</span>
                <select
                  value={createForm.plan}
                  onChange={(e) => setCreateForm((f) => ({ ...f, plan: e.target.value }))}
                  className="mt-1 w-full px-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-100 text-sm"
                >
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </label>
              <Field
                label="ΑΦΜ (προαιρετικό)"
                value={createForm.vat_number}
                onChange={(v) => setCreateForm((f) => ({ ...f, vat_number: v }))}
              />
            </div>
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Admin γραφείου</p>
              <Field
                label="Ονοματεπώνυμο"
                value={createForm.admin_full_name}
                onChange={(v) => setCreateForm((f) => ({ ...f, admin_full_name: v }))}
                required
              />
              <Field
                label="Email"
                type="email"
                value={createForm.admin_email}
                onChange={(v) => setCreateForm((f) => ({ ...f, admin_email: v }))}
                required
              />
              <Field
                label="Κωδικός (≥ 8)"
                type="password"
                value={createForm.admin_password}
                onChange={(v) => setCreateForm((f) => ({ ...f, admin_password: v }))}
                required
                minLength={8}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" disabled={working} onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-full border text-sm font-bold">
                Άκυρο
              </button>
              <button type="submit" disabled={working} className="px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-bold disabled:opacity-50">
                Δημιουργία
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title={`Επεξεργασία: ${editing.slug}`} onClose={() => !working && setEditing(null)}>
          <form onSubmit={submitEdit} className="space-y-4">
            <Field
              label="Επωνυμία"
              value={editForm.legal_name}
              onChange={(v) => setEditForm((f) => ({ ...f, legal_name: v }))}
              required
            />
            <label className="block text-sm">
              <span className="font-bold text-slate-500">Πλάνο</span>
              <select
                value={editForm.plan}
                onChange={(e) => setEditForm((f) => ({ ...f, plan: e.target.value }))}
                className="mt-1 w-full px-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-100 text-sm"
              >
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </label>
            <Field label="ΑΦΜ" value={editForm.vat_number} onChange={(v) => setEditForm((f) => ({ ...f, vat_number: v }))} />
            <Field
              label="Custom domain"
              value={editForm.custom_domain}
              onChange={(v) => setEditForm((f) => ({ ...f, custom_domain: v }))}
              placeholder="example.com"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" disabled={working} onClick={() => setEditing(null)} className="px-4 py-2 rounded-full border text-sm font-bold">
                Άκυρο
              </button>
              <button type="submit" disabled={working} className="px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-bold disabled:opacity-50">
                Αποθήκευση
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function TenantCard({ tenant, working, onOpen, onEdit, onToggle }) {
  const plan = PLAN_META[tenant.plan] || PLAN_META.starter;
  const subKey = String(tenant.subscription?.status || '').toLowerCase();
  const sub = SUB_META[subKey] || { label: tenant.subscription?.status || '—', chip: 'bg-slate-100 text-slate-600' };
  const host = officeHost(tenant);

  return (
    <article className={`rounded-[24px] border bg-gradient-to-br p-4 shadow-sm ${plan.accent}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h5 className="font-bold text-slate-900 truncate">{tenant.legal_name}</h5>
            {isRecent(tenant.created_at) && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">ΝΕΟ</span>
            )}
          </div>
          <p className="text-[11px] font-mono text-slate-500 mt-0.5">{tenant.slug}</p>
          {host && <p className="text-[11px] text-sky-700 mt-0.5 truncate">{host}</p>}
        </div>
        <span
          className={`px-2 py-1 rounded-full text-[10px] font-bold shrink-0 ${
            tenant.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
          }`}
        >
          {tenant.is_active ? 'ενεργό' : 'αναστολή'}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${plan.chip}`}>{plan.label}</span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sub.chip}`}>{sub.label}</span>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/80 text-slate-500 border border-slate-100">
          {formatDate(tenant.created_at)}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-4">
        <ActionBtn disabled={working || !tenant.is_active} onClick={onOpen} tone="primary" icon="login" label="Άνοιγμα" />
        <ActionBtn disabled={working} onClick={onEdit} tone="neutral" icon="edit" label="Επεξεργασία" />
        <ActionBtn
          disabled={working}
          onClick={onToggle}
          tone={tenant.is_active ? 'danger' : 'success'}
          icon={tenant.is_active ? 'block' : 'check_circle'}
          label={tenant.is_active ? 'Αναστολή' : 'Επανενεργοποίηση'}
        />
      </div>
    </article>
  );
}

function ActionBtn({ disabled, onClick, tone, icon, label }) {
  const tones = {
    primary: 'bg-sky-600 text-white hover:bg-sky-700',
    neutral: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
    danger: 'bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100',
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold disabled:opacity-50 ${tones[tone]}`}
    >
      <span className="material-symbols-outlined text-[14px]">{icon}</span>
      {label}
    </button>
  );
}

function Metric({ label, value, warn, icon }) {
  return (
    <div className={`rounded-2xl p-4 ${warn ? 'bg-amber-500/20' : 'bg-white/10'} backdrop-blur-sm`}>
      <div className="flex items-center gap-2 text-sky-100/90">
        {icon && <span className="material-symbols-outlined text-[18px]">{icon}</span>}
        <span className="text-[11px] uppercase tracking-wide font-bold">{label}</span>
      </div>
      <div className="text-2xl font-bold mt-1.5 tracking-tight">{value}</div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[28px] bg-white shadow-2xl border border-slate-100 p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h4 className="text-lg font-bold text-slate-900">{title}</h4>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required, minLength, placeholder }) {
  return (
    <label className="block text-sm">
      <span className="font-bold text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-100 text-sm outline-none focus:ring-2 focus:ring-sky-200"
      />
    </label>
  );
}
