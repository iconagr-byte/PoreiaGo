/**
 * Edit marketing cards for bus SaaS plans (Starter / Pro / Enterprise + custom).
 * Saves to platform catalog — /grafeia and homepage hero refresh from the same API.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AGENCY_PLANS,
  BUILTIN_AGENCY_PLAN_IDS,
  DEFAULT_AGENCY_SECTION_TITLE,
  displayPrice,
  mergeAgencyPlanCatalog,
  normalizeAgencyPlan,
} from '../../lib/billing/planCatalog.js';
import {
  fetchAdminAgencyPlanCatalog,
  updateAgencyPlanCatalog,
} from '../../services/agencyPlanCatalogApi.js';

function planToForm(plan) {
  const n = normalizeAgencyPlan(plan, AGENCY_PLANS.find((p) => p.id === plan?.id) || null);
  return {
    id: n.id,
    name: n.name || '',
    tagline: n.tagline || '',
    monthlyEur: n.contactSales ? '' : n.monthlyEur ?? '',
    features: (n.features || []).length ? [...n.features] : [''],
    highlighted: Boolean(n.highlighted),
    contactSales: Boolean(n.contactSales),
    visible: n.visible !== false,
    icon: n.icon || 'workspace_premium',
    builtin: Boolean(n.builtin) || BUILTIN_AGENCY_PLAN_IDS.has(n.id),
  };
}

function formToPlan(form) {
  const monthly = Number(form.monthlyEur);
  return {
    id: form.id,
    name: String(form.name || '').trim(),
    tagline: String(form.tagline || '').trim(),
    monthlyEur: form.contactSales ? null : Number.isFinite(monthly) ? monthly : 0,
    features: (form.features || []).map((l) => String(l).trim()).filter(Boolean),
    highlighted: Boolean(form.highlighted),
    contactSales: Boolean(form.contactSales),
    visible: Boolean(form.visible),
    icon: String(form.icon || 'workspace_premium').trim() || 'workspace_premium',
    builtin: Boolean(form.builtin),
    kind: 'buses',
  };
}

function snapshotOf(sectionTitle, plans) {
  return JSON.stringify({
    sectionTitle,
    plans: plans.map(formToPlan),
  });
}

const ICON_OPTIONS = [
  'storefront',
  'apartment',
  'domain',
  'workspace_premium',
  'rocket_launch',
  'diamond',
  'business_center',
  'hub',
];

function FeatureRows({ features, onChange }) {
  const rows = features?.length ? features : [''];
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-600">Features</span>
        <button
          type="button"
          className="text-xs font-bold text-sky-700 hover:underline inline-flex items-center gap-1"
          onClick={() => onChange([...rows, ''])}
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          Προσθήκη
        </button>
      </div>
      <ul className="space-y-2">
        {rows.map((row, idx) => (
          <li key={`f-${idx}`} className="flex gap-2 items-center">
            <span className="text-[10px] font-bold text-slate-400 w-4 tabular-nums">{idx + 1}</span>
            <input
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={row}
              placeholder="π.χ. Live GPS & telematics"
              onChange={(e) => {
                const next = [...rows];
                next[idx] = e.target.value;
                onChange(next);
              }}
            />
            <button
              type="button"
              className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
              onClick={() =>
                onChange(rows.length <= 1 ? [''] : rows.filter((_, i) => i !== idx))
              }
              title="Αφαίρεση"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlanEditorCard({ form, onChange, onRemove, canRemove }) {
  const preview = displayPrice(formToPlan(form), 'month');
  const set = (key) => (e) => {
    const value = e?.target?.type === 'checkbox' ? e.target.checked : e.target.value;
    onChange({ ...form, [key]: value });
  };

  return (
    <article
      className={`rounded-[22px] border overflow-hidden bg-white shadow-sm flex flex-col h-full ${
        form.visible ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-80'
      }`}
    >
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">{form.icon}</span>
          </span>
          <div className="min-w-0">
            <p className="font-bold text-slate-900 truncate">{form.name || 'Νέο πλάνο'}</p>
            <p className="text-[11px] text-slate-500 font-mono truncate">{form.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {form.builtin ? (
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
              Core
            </span>
          ) : null}
          <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
            <input type="checkbox" checked={form.visible} onChange={set('visible')} />
            Εμφάνιση
          </label>
          {canRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="w-8 h-8 rounded-lg text-rose-600 hover:bg-rose-50"
              title="Αφαίρεση πλάνου"
            >
              <span className="material-symbols-outlined text-[20px]">delete</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="p-4 grid lg:grid-cols-2 gap-4 flex-1">
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-600">
            Όνομα
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
              value={form.name}
              onChange={set('name')}
            />
          </label>
          <label className="block text-xs font-bold text-slate-600">
            Tagline
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.tagline}
              onChange={set('tagline')}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-bold text-slate-600">
              Τιμή €/μήνα
              <input
                type="number"
                min="0"
                step="1"
                disabled={form.contactSales}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
                value={form.monthlyEur}
                onChange={set('monthlyEur')}
                placeholder="—"
              />
            </label>
            <label className="block text-xs font-bold text-slate-600">
              Εικονίδιο
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form.icon}
                onChange={set('icon')}
              >
                {ICON_OPTIONS.map((ic) => (
                  <option key={ic} value={ic}>
                    {ic}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-600">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={form.highlighted} onChange={set('highlighted')} />
              Προτεινόμενο
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={form.contactSales} onChange={set('contactSales')} />
              Κατόπιν συνεννόησης
            </label>
          </div>
          <FeatureRows
            features={form.features}
            onChange={(features) => onChange({ ...form, features })}
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4 flex flex-col min-h-[260px]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
            Προεπισκόπηση κάρτας
          </p>
          {form.highlighted ? (
            <span className="self-start mb-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-sky-600 text-white">
              Προτεινόμενο
            </span>
          ) : null}
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-sky-700">{form.icon}</span>
            <h4 className="font-bold text-lg text-slate-900">{form.name || '—'}</h4>
          </div>
          <p className="text-xs text-slate-500 mb-3">{form.tagline || '—'}</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums mb-3">
            {preview.label}
            {preview.suffix ? (
              <span className="text-sm font-semibold text-slate-500">{preview.suffix}</span>
            ) : null}
          </p>
          <ul className="space-y-1.5 flex-1 text-xs text-slate-600">
            {(form.features || []).filter(Boolean).slice(0, 6).map((f) => (
              <li key={f} className="flex gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-sky-600">check</span>
                {f}
              </li>
            ))}
          </ul>
          {!form.visible ? (
            <p className="mt-3 text-[11px] font-bold text-amber-700">Κρυφό από δημόσιες σελίδες</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function AgencyPlanCatalogEditor({ compact = false } = {}) {
  const [sectionTitle, setSectionTitle] = useState(DEFAULT_AGENCY_SECTION_TITLE);
  const [plans, setPlans] = useState(() => AGENCY_PLANS.map(planToForm));
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(!compact);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminAgencyPlanCatalog();
      const next = (data.plans || []).map(planToForm);
      setSectionTitle(data.sectionTitle);
      setPlans(next);
      setSavedSnapshot(snapshotOf(data.sectionTitle, next));
    } catch {
      toast.error('Αποτυχία φόρτωσης συμβολαίων');
      const fallback = mergeAgencyPlanCatalog(null);
      const next = fallback.plans.map(planToForm);
      setSectionTitle(fallback.sectionTitle);
      setPlans(next);
      setSavedSnapshot(snapshotOf(fallback.sectionTitle, next));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(
    () => snapshotOf(sectionTitle, plans) !== savedSnapshot,
    [sectionTitle, plans, savedSnapshot],
  );

  const onSave = async (e) => {
    e?.preventDefault?.();
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        sectionTitle,
        plans: plans.map(formToPlan),
      };
      const saved = await updateAgencyPlanCatalog(payload);
      const next = saved.plans.map(planToForm);
      setSectionTitle(saved.sectionTitle);
      setPlans(next);
      setSavedSnapshot(snapshotOf(saved.sectionTitle, next));
      toast.success('Τα συμβόλαια αποθηκεύτηκαν — ενημερώνονται /grafeia & hero');
      window.dispatchEvent(new Event('agency-plan-catalog-changed'));
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  const addPlan = () => {
    const id = `custom_${Date.now().toString(36)}`;
    setPlans((prev) => [
      ...prev,
      planToForm({
        id,
        name: 'Νέο πλάνο',
        tagline: 'Περιγραφή για το γραφείο',
        monthlyEur: null,
        features: ['Feature 1', 'Feature 2'],
        highlighted: false,
        // Custom cards are marketing / sales — Stripe IDs stay starter|professional|rent.
        contactSales: true,
        visible: true,
        icon: 'workspace_premium',
        builtin: false,
      }),
    ]);
    setOpen(true);
  };

  const removePlan = (id) => {
    const target = plans.find((p) => p.id === id);
    if (!target) return;
    if (target.builtin) {
      setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, visible: false } : p)));
      toast('Core πλάνο — αποκρύφθηκε αντί για διαγραφή', { icon: 'ℹ️' });
      return;
    }
    setPlans((prev) => prev.filter((p) => p.id !== id));
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 flex items-center gap-2">
        <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
        Φόρτωση συμβολαίων…
      </div>
    );
  }

  return (
    <form
      onSubmit={onSave}
      className="rounded-[24px] border border-slate-200/90 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.04)] overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-sky-50/80 to-white flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700/80">
            Marketing · δημόσιες σελίδες
          </p>
          <h3 className="font-bold text-slate-900 text-lg">Παραμετροποίηση συμβολαίων</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Τιμές, features, εμφάνιση — ενημερώνουν /grafeia και το hero στην αρχική.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty ? (
            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              Μη αποθηκευμένες αλλαγές
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="px-3 py-2 rounded-full border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            {open ? 'Σύμπτυξη' : 'Επεξεργασία'}
          </button>
          <a
            href="/grafeia"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-full border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
          >
            /grafeia
            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
          </a>
          <button
            type="button"
            onClick={addPlan}
            className="px-3 py-2 rounded-full bg-slate-900 text-white text-xs font-bold inline-flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Νέο συμβόλαιο
          </button>
          <button
            type="submit"
            disabled={saving || !dirty}
            className="px-4 py-2 rounded-full bg-sky-600 text-white text-xs font-bold disabled:opacity-50"
          >
            {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
          </button>
        </div>
      </div>

      {open ? (
        <div className="p-5 space-y-4">
          <label className="block text-xs font-bold text-slate-600 max-w-xl">
            Τίτλος ενότητας στη σελίδα συμβολαίων
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
            />
          </label>

          <div className="grid lg:grid-cols-1 gap-4">
            {plans.map((plan, index) => (
              <PlanEditorCard
                key={plan.id}
                form={plan}
                onChange={(next) =>
                  setPlans((prev) => prev.map((p, i) => (i === index ? next : p)))
                }
                onRemove={() => removePlan(plan.id)}
                canRemove={!plan.builtin || plan.visible}
              />
            ))}
          </div>

          <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-white/95 backdrop-blur px-4 py-3 shadow-lg">
            <p className="text-sm text-slate-500">
              {dirty
                ? 'Οι αλλαγές θα φανούν στο hero και στο /grafeia μετά την αποθήκευση.'
                : 'Όλα αποθηκευμένα.'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addPlan}
                className="px-4 py-2 rounded-full border border-slate-200 text-sm font-bold"
              >
                Προσθήκη
              </button>
              <button
                type="submit"
                disabled={saving || !dirty}
                className="px-5 py-2 rounded-full bg-sky-600 text-white text-sm font-bold disabled:opacity-50"
              >
                {saving ? 'Αποθήκευση…' : 'Αποθήκευση συμβολαίων'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-5 py-4 grid sm:grid-cols-3 gap-3">
          {plans
            .filter((p) => p.visible)
            .map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm"
              >
                <p className="font-bold text-slate-900">{p.name}</p>
                <p className="text-xs text-slate-500">
                  {p.contactSales ? 'Κατόπιν συνεννόησης' : `€${p.monthlyEur}/μήνα`}
                </p>
              </div>
            ))}
        </div>
      )}
    </form>
  );
}
