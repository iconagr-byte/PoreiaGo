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

const PLAN_BADGE = {
  starter: 'bg-slate-100 text-slate-700',
  professional: 'bg-indigo-100 text-indigo-800',
  enterprise: 'bg-violet-100 text-violet-800',
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

export default function SuperAdminPanel() {
  const [overview, setOverview] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
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

  const load = useCallback(async (query) => {
    if (!getSaasToken() || !isSaasSuperAdmin()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [ov, list] = await Promise.all([
        fetchPlatformOverview(),
        fetchPlatformTenants({ limit: 100, q: query || undefined }),
      ]);
      setOverview(ov);
      setTenants(list.items || []);
      setTotal(list.total ?? 0);
    } catch (e) {
      toast.error(e.message || 'Αποτυχία φόρτωσης γραφείων');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load('');
  }, [load]);

  const recentOffices = useMemo(() => {
    const fromOverview = Array.isArray(overview?.recent_tenants) ? overview.recent_tenants : [];
    if (fromOverview.length) return fromOverview.slice(0, 5);
    return tenants.filter((t) => isRecent(t.created_at)).slice(0, 5);
  }, [overview, tenants]);

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
        toast.success(`Αναστολή: ${tenant.legal_name || tenant.slug}`);
      } else {
        await reactivatePlatformTenant(tenant.id);
        toast.success(`Επανενεργοποίηση: ${tenant.legal_name || tenant.slug}`);
      }
      load(search);
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
      load(search);
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
      load(search);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία ενημέρωσης');
    } finally {
      setWorking(false);
    }
  };

  if (!getSaasToken()) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-[24px] p-6 text-sm text-amber-900">
        Συνδεθείτε με λογαριασμό πλατφόρμας (superadmin).
      </div>
    );
  }

  if (!isSaasSuperAdmin()) {
    return (
      <div className="bg-surface-container-low rounded-[24px] border p-6 text-sm text-on-surface-variant">
        <span className="material-symbols-outlined align-middle mr-2 text-gray-400">lock</span>
        Απαιτείται ρόλος <strong>superadmin</strong> για τη διαχείριση γραφείων.
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
              Πλατφόρμα PoreiaGo
            </p>
            <h3 className="text-xl font-bold">Διαχείριση Γραφείων</h3>
            <p className="text-sm text-slate-300 mt-1">
              Όλα τα γραφεία που δημιουργούνται από signup ή από εσάς · {total} συνολικά
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => load(search)}
              disabled={loading}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20"
              title="Ανανέωση"
            >
              <span className="material-symbols-outlined">refresh</span>
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded-full bg-white text-slate-900 text-sm font-bold"
            >
              + Νέο γραφείο
            </button>
            <button
              type="button"
              onClick={runUsageJob}
              disabled={working}
              className="px-4 py-2 rounded-full bg-white/15 text-white text-sm font-bold disabled:opacity-50"
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
            <Metric label="Ενεργά γραφεία" value={billing.active_tenants} />
            <Metric label="Trial" value={billing.trial_tenants} />
            <Metric label="Past due" value={billing.past_due_tenants} warn={billing.past_due_tenants > 0} />
          </div>
        ) : null}

        {overview && (
          <p className="text-xs text-slate-400 mt-4">
            {overview.total_users} χρήστες · {overview.total_bookings} κρατήσεις (όλη η πλατφόρμα)
          </p>
        )}
      </div>

      {recentOffices.length > 0 && (
        <div className="bg-white rounded-[24px] border p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h4 className="font-bold text-on-surface">Πρόσφατα γραφεία</h4>
            <span className="text-xs text-on-surface-variant">τελευταίες εγγραφές</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentOffices.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={working || t.is_active === false}
                onClick={() => openAsOffice(t)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 text-left disabled:opacity-50"
                title="Άνοιγμα ως admin γραφείου"
              >
                <span className="material-symbols-outlined text-[18px] text-indigo-600">storefront</span>
                <span>
                  <span className="block text-sm font-bold text-on-surface">{t.legal_name || t.slug}</span>
                  <span className="block text-[11px] text-on-surface-variant font-mono">{t.slug}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-[24px] border p-6 shadow-sm">
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(search)}
            placeholder="Αναζήτηση ονόματος ή slug…"
            className="flex-1 min-w-[200px] px-4 py-2.5 rounded-2xl bg-gray-50 text-sm"
          />
          <button
            type="button"
            onClick={() => load(search)}
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
                  <th className="pb-3 pr-4">Γραφείο</th>
                  <th className="pb-3 pr-4">Πλάνο</th>
                  <th className="pb-3 pr-4">Συνδρομή</th>
                  <th className="pb-3 pr-4">Κατάσταση</th>
                  <th className="pb-3 pr-4">Δημιουργία</th>
                  <th className="pb-3">Ενέργειες</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/80">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="font-bold">{t.legal_name}</div>
                        {isRecent(t.created_at) && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            ΝΕΟ
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">{t.slug}</div>
                      {t.subdomain ? (
                        <div className="text-[11px] text-gray-400">{t.subdomain}.poreiago.com</div>
                      ) : null}
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
                    <td className="py-3 pr-4 text-xs">{t.subscription?.status || '—'}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          t.is_active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {t.is_active ? 'ενεργό' : 'σε αναστολή'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(t.created_at)}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2 items-center">
                        <button
                          type="button"
                          disabled={working || !t.is_active}
                          onClick={() => openAsOffice(t)}
                          className="text-xs font-bold text-indigo-600 hover:underline disabled:opacity-50"
                          title="Άνοιγμα Control Panel ως admin του γραφείου"
                        >
                          Άνοιγμα
                        </button>
                        <button
                          type="button"
                          disabled={working}
                          onClick={() => openEdit(t)}
                          className="text-xs font-bold text-slate-700 hover:underline disabled:opacity-50"
                        >
                          Επεξεργασία
                        </button>
                        {t.is_active ? (
                          <button
                            type="button"
                            disabled={working}
                            onClick={() => toggleTenant(t, true)}
                            className="text-xs font-bold text-rose-600 hover:underline disabled:opacity-50"
                          >
                            Αναστολή
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={working}
                            onClick={() => toggleTenant(t, false)}
                            className="text-xs font-bold text-emerald-600 hover:underline disabled:opacity-50"
                          >
                            Επανενεργοποίηση
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tenants.length === 0 && (
              <p className="text-center text-gray-500 py-8">
                Δεν βρέθηκαν γραφεία ακόμη. Δημιουργήστε ένα ή περιμένετε signup από{' '}
                <code className="text-xs">/grafeia/signup</code>.
              </p>
            )}
          </div>
        )}
      </div>

      {showCreate && (
        <Modal title="Νέο γραφείο" onClose={() => !working && setShowCreate(false)}>
          <form onSubmit={submitCreate} className="space-y-4">
            <Field
              label="Επωνυμία"
              value={createForm.legal_name}
              onChange={onCreateNameChange}
              required
            />
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
                <span className="font-bold text-on-surface-variant">Πλάνο</span>
                <select
                  value={createForm.plan}
                  onChange={(e) => setCreateForm((f) => ({ ...f, plan: e.target.value }))}
                  className="mt-1 w-full px-3 py-2.5 rounded-2xl bg-gray-50 text-sm"
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
            <div className="border-t pt-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                Admin γραφείου
              </p>
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
              <button
                type="button"
                disabled={working}
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-full border text-sm font-bold"
              >
                Άκυρο
              </button>
              <button
                type="submit"
                disabled={working}
                className="px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-bold disabled:opacity-50"
              >
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
              <span className="font-bold text-on-surface-variant">Πλάνο</span>
              <select
                value={editForm.plan}
                onChange={(e) => setEditForm((f) => ({ ...f, plan: e.target.value }))}
                className="mt-1 w-full px-3 py-2.5 rounded-2xl bg-gray-50 text-sm"
              >
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </label>
            <Field
              label="ΑΦΜ"
              value={editForm.vat_number}
              onChange={(v) => setEditForm((f) => ({ ...f, vat_number: v }))}
            />
            <Field
              label="Custom domain"
              value={editForm.custom_domain}
              onChange={(v) => setEditForm((f) => ({ ...f, custom_domain: v }))}
              placeholder="example.com"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={working}
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-full border text-sm font-bold"
              >
                Άκυρο
              </button>
              <button
                type="submit"
                disabled={working}
                className="px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-bold disabled:opacity-50"
              >
                Αποθήκευση
              </button>
            </div>
          </form>
        </Modal>
      )}
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

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[24px] bg-white shadow-2xl border p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h4 className="text-lg font-bold">{title}</h4>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  minLength,
  placeholder,
}) {
  return (
    <label className="block text-sm">
      <span className="font-bold text-on-surface-variant">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2.5 rounded-2xl bg-gray-50 text-sm"
      />
    </label>
  );
}
