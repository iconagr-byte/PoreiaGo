/**
 * Edit marketing cards for bus SaaS plans (Starter / Pro / Enterprise + custom).
 * Saves to platform catalog — /grafeia, homepage hero, and Contracts cards refresh together.
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

function FeatureRows({ features, onChange, accent = 'sky' }) {
  const rows = features?.length ? features : [''];
  const accentBtn =
    accent === 'emerald'
      ? 'text-emerald-700 hover:bg-emerald-50'
      : accent === 'violet'
        ? 'text-violet-700 hover:bg-violet-50'
        : 'text-sky-700 hover:bg-sky-50';

  const updateRow = (idx, value) => {
    const next = [...rows];
    next[idx] = value;
    onChange(next);
  };

  const addRow = () => onChange([...rows, '']);

  const removeRow = (idx) => {
    onChange(rows.length <= 1 ? [''] : rows.filter((_, i) => i !== idx));
  };

  const moveRow = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-600">
          Features <span className="font-semibold text-slate-400">({rows.filter(Boolean).length})</span>
        </span>
        <button
          type="button"
          className={`text-xs font-bold inline-flex items-center gap-1 rounded-lg px-2 py-1 ${accentBtn}`}
          onClick={addRow}
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          Προσθήκη
        </button>
      </div>
      <ul className="space-y-2">
        {rows.map((row, idx) => (
          <li key={`f-${idx}`} className="flex gap-1.5 items-center">
            <div className="flex flex-col shrink-0">
              <button
                type="button"
                className="h-5 w-7 rounded-t-md border border-b-0 border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-30"
                disabled={idx === 0}
                onClick={() => moveRow(idx, -1)}
                title="Πάνω"
                aria-label="Μετακίνηση πάνω"
              >
                <span className="material-symbols-outlined text-[14px]">expand_less</span>
              </button>
              <button
                type="button"
                className="h-5 w-7 rounded-b-md border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-30"
                disabled={idx === rows.length - 1}
                onClick={() => moveRow(idx, 1)}
                title="Κάτω"
                aria-label="Μετακίνηση κάτω"
              >
                <span className="material-symbols-outlined text-[14px]">expand_more</span>
              </button>
            </div>
            <input
              className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15"
              value={row}
              placeholder="π.χ. Live GPS & telematics"
              onChange={(e) => updateRow(idx, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addRow();
                }
              }}
            />
            <button
              type="button"
              className="w-8 h-8 shrink-0 rounded-lg border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
              onClick={() => removeRow(idx)}
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

function PlanFeatureCard({ form, onChange, onRemove, canRemove, detailsOpen, onToggleDetails }) {
  const preview = displayPrice(formToPlan(form), 'month');
  const set = (key) => (e) => {
    const value = e?.target?.type === 'checkbox' ? e.target.checked : e.target.value;
    onChange({ ...form, [key]: value });
  };
  const accent =
    form.id === 'professional' ? 'emerald' : form.id === 'enterprise' ? 'violet' : 'sky';
  const ring =
    form.id === 'professional'
      ? 'border-emerald-200/80 from-emerald-50/50'
      : form.id === 'enterprise'
        ? 'border-violet-200/80 from-violet-50/40'
        : 'border-sky-200/80 from-sky-50/50';

  return (
    <article
      className={`rounded-[22px] border bg-gradient-to-b ${ring} to-white shadow-sm flex flex-col overflow-hidden ${
        form.visible ? '' : 'opacity-75 border-dashed'
      }`}
    >
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-700 shadow-sm">
            <span className="material-symbols-outlined text-[22px]">{form.icon}</span>
          </span>
          <div className="min-w-0">
            <p className="font-extrabold text-slate-900 text-lg leading-tight truncate">
              {form.name || 'Νέο πλάνο'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{form.tagline || '—'}</p>
            <p className="text-sm font-bold text-slate-800 mt-1.5 tabular-nums">
              {preview.label}
              {preview.suffix ? (
                <span className="text-xs font-semibold text-slate-500">{preview.suffix}</span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {form.builtin ? (
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-600">
              Core
            </span>
          ) : null}
          <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 cursor-pointer">
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

      <div className="px-4 pb-4 flex-1">
        <FeatureRows
          features={form.features}
          onChange={(features) => onChange({ ...form, features })}
          accent={accent}
        />
      </div>

      <div className="border-t border-slate-200/80 bg-white/70 px-3 py-2">
        <button
          type="button"
          onClick={onToggleDetails}
          className="w-full flex items-center justify-between gap-2 rounded-xl px-2 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">tune</span>
            Όνομα, τιμή & εικονίδιο
          </span>
          <span className="material-symbols-outlined text-[18px]">
            {detailsOpen ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {detailsOpen ? (
          <div className="px-1 pb-3 pt-1 space-y-3">
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
          </div>
        ) : null}
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
  // Features must stay visible — compact only collapses the section title field.
  const [showSectionTitle, setShowSectionTitle] = useState(!compact);
  const [detailsOpenId, setDetailsOpenId] = useState(null);

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
    const emptyFeatures = plans.filter((p) => p.visible && !(p.features || []).some((f) => String(f).trim()));
    if (emptyFeatures.length) {
      toast.error(`Προσθέστε τουλάχιστον 1 feature σε: ${emptyFeatures.map((p) => p.name).join(', ')}`);
      return;
    }
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
      toast.success('Features & κάρτες αποθηκεύτηκαν — /grafeia, hero & Συμβόλαια');
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
        contactSales: true,
        visible: true,
        icon: 'workspace_premium',
        builtin: false,
      }),
    ]);
    setDetailsOpenId(id);
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
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-sky-50/90 via-white to-emerald-50/40 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700/80">
            Παραμετροποίηση · όλες οι κάρτες
          </p>
          <h3 className="font-bold text-slate-900 text-lg">Features συμβολαίων γραφείου</h3>
          <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
            Επεξεργαστείτε τα features σε Starter, Professional, Enterprise (και custom). Ισχύουν στο
            /grafeia, στο hero και στις κάρτες επιλογής παρακάτω.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty ? (
            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              Μη αποθηκευμένες αλλαγές
            </span>
          ) : (
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              Αποθηκευμένα
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowSectionTitle((v) => !v)}
            className="px-3 py-2 rounded-full border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            {showSectionTitle ? 'Απόκρυψη τίτλου' : 'Τίτλος ενότητας'}
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
            Νέα κάρτα
          </button>
          <button
            type="submit"
            disabled={saving || !dirty}
            className="px-4 py-2 rounded-full bg-sky-600 text-white text-xs font-bold disabled:opacity-50"
          >
            {saving ? 'Αποθήκευση…' : 'Αποθήκευση features'}
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {showSectionTitle ? (
          <label className="block text-xs font-bold text-slate-600 max-w-xl">
            Τίτλος ενότητας στη σελίδα συμβολαίων
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
            />
          </label>
        ) : null}

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
          {plans.map((plan, index) => (
            <PlanFeatureCard
              key={plan.id}
              form={plan}
              onChange={(next) =>
                setPlans((prev) => prev.map((p, i) => (i === index ? next : p)))
              }
              onRemove={() => removePlan(plan.id)}
              canRemove={!plan.builtin || plan.visible}
              detailsOpen={detailsOpenId === plan.id}
              onToggleDetails={() =>
                setDetailsOpenId((cur) => (cur === plan.id ? null : plan.id))
              }
            />
          ))}
        </div>

        <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-white/95 backdrop-blur px-4 py-3 shadow-lg">
          <p className="text-sm text-slate-500">
            {dirty
              ? 'Αποθηκεύστε για να ενημερωθούν οι κάρτες επιλογής, το /grafeia και το hero.'
              : 'Όλα τα features είναι αποθηκευμένα.'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addPlan}
              className="px-4 py-2 rounded-full border border-slate-200 text-sm font-bold"
            >
              Νέα κάρτα
            </button>
            <button
              type="submit"
              disabled={saving || !dirty}
              className="px-5 py-2 rounded-full bg-sky-600 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
