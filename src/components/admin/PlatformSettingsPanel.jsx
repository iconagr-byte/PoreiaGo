import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  DEFAULT_PLATFORM_SETTINGS,
  fetchPlatformSettings,
  normalizePlatformSettings,
  updatePlatformSettings,
} from '../../services/platformApi.js';
import AbandonedRecoveryPanel from './AbandonedRecoveryPanel.jsx';

const LOCALES = [
  { value: 'el-GR', label: 'Ελληνικά (el-GR)' },
  { value: 'en-GB', label: 'English UK (en-GB)' },
  { value: 'en-US', label: 'English US (en-US)' },
  { value: 'de-DE', label: 'Deutsch (de-DE)' },
  { value: 'it-IT', label: 'Italiano (it-IT)' },
  { value: 'fr-FR', label: 'Français (fr-FR)' },
];

const TIMEZONES = [
  { value: 'Europe/Athens', label: 'Αθήνα (Europe/Athens)' },
  { value: 'Europe/Nicosia', label: 'Λευκωσία (Europe/Nicosia)' },
  { value: 'Europe/Berlin', label: 'Βερολίνο (Europe/Berlin)' },
  { value: 'Europe/London', label: 'Λονδίνο (Europe/London)' },
  { value: 'UTC', label: 'UTC' },
];

const NAV_SECTIONS = [
  { id: 'company', label: 'Εταιρεία', icon: 'business' },
  { id: 'abandoned', label: 'Abandoned', icon: 'shopping_cart_checkout' },
  { id: 'pricing', label: 'Pricing', icon: 'sell' },
  { id: 'notify', label: 'Ειδοποιήσεις', icon: 'mail' },
  { id: 'payments', label: 'Πληρωμές', icon: 'account_balance' },
];

const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-bold text-slate-800">{label}</span>
      {hint ? <p className="mt-0.5 text-xs text-slate-500 leading-snug">{hint}</p> : null}
      {children}
    </label>
  );
}

function SectionCard({ id, icon, title, description, children, accent = 'bg-primary' }) {
  return (
    <section
      id={id}
      className="scroll-mt-28 overflow-hidden rounded-[24px] border border-black/[0.06] bg-white shadow-sm"
    >
      <div className="flex items-start gap-3 border-b border-black/[0.04] bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:px-6">
        <span
          className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${accent} text-white shadow-sm`}
        >
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </span>
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900 text-[17px] leading-tight">{title}</h3>
          {description ? (
            <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-2xl">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function ToggleRow({ checked, onChange, title, hint, danger = false }) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 ${
        danger && checked
          ? 'border-amber-300 bg-amber-50'
          : checked
            ? 'border-primary/20 bg-primary/[0.04]'
            : 'border-slate-200 bg-slate-50/80'
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900">{title}</p>
        {hint ? <p className="mt-0.5 text-xs text-slate-500 leading-snug">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? (danger ? 'bg-amber-500' : 'bg-primary') : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function StatusChip({ icon, label, value, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    sky: 'border-sky-200 bg-sky-50 text-sky-800',
  };
  return (
    <div className={`rounded-2xl border px-3.5 py-3 ${tones[tone] || tones.slate}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-70">
        <span className="material-symbols-outlined text-[14px]">{icon}</span>
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-bold">{value}</p>
    </div>
  );
}

function pctFromRatio(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return Math.round(n * 100);
}

function ratioFromPct(raw) {
  if (raw === '' || raw == null) return '';
  const n = Number(raw);
  if (!Number.isFinite(n)) return '';
  return Math.min(100, Math.max(0, n)) / 100;
}

export default function PlatformSettingsPanel({ onOpenPayments }) {
  const [form, setForm] = useState(DEFAULT_PLATFORM_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [activeNav, setActiveNav] = useState('company');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setForm(await fetchPlatformSettings());
      setDirty(false);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία φόρτωσης ρυθμίσεων');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const ids = NAV_SECTIONS.map((s) => s.id);
    const nodes = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!nodes.length) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActiveNav(visible.target.id);
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0.15, 0.4, 0.7] },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [loading]);

  const patch = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const onSave = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      const payload = normalizePlatformSettings(form);
      const { data, source, offline } = await updatePlatformSettings(payload);
      setForm(data);
      setDirty(false);
      setLastSavedAt(new Date());
      if (offline) {
        toast.success('Αποθηκεύτηκε τοπικά — ο server δεν είναι διαθέσιμος');
      } else if (source === 'server') {
        toast.success('Οι ρυθμίσεις γραφείου αποθηκεύτηκαν');
      } else {
        toast.success('Οι ρυθμίσεις αποθηκεύτηκαν');
      }
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  const useCurrentOrigin = () => {
    patch('checkout_base_url', window.location.origin);
    toast.success('Ορίστηκε το τρέχον domain');
  };

  const localeLabel = useMemo(() => {
    const hit = LOCALES.find((l) => l.value === form.default_locale);
    return hit?.label || form.default_locale || '—';
  }, [form.default_locale]);

  const scrollTo = (id) => {
    setActiveNav(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return (
      <div className="rounded-[24px] border border-black/[0.06] bg-white px-6 py-16 text-center shadow-sm">
        <span className="material-symbols-outlined animate-spin text-primary text-[28px]">
          progress_activity
        </span>
        <p className="mt-3 text-sm text-slate-500">Φόρτωση ρυθμίσεων γραφείου…</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSave} className="relative space-y-5 pb-24">
      <div className="overflow-hidden rounded-[24px] border border-black/[0.06] bg-white shadow-sm">
        <div className="bg-gradient-to-br from-sky-50 via-white to-emerald-50/40 px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700/80">
                Ρυθμίσεις γραφείου
              </p>
              <h3 className="mt-1 font-headline-md text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {form.company_name || 'Γραφείο'}
              </h3>
              <p className="mt-1.5 max-w-xl text-sm text-slate-600">
                Βασικά στοιχεία, locale, abandoned recovery και δυναμική τιμολόγηση — αποθήκευση με ένα κλικ.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                Ανανέωση
              </button>
              <button
                type="submit"
                disabled={saving || !dirty}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">save</span>
                {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <StatusChip icon="apartment" label="Επωνυμία" value={form.company_name || '—'} tone="sky" />
            <StatusChip icon="translate" label="Γλώσσα" value={localeLabel} />
            <StatusChip icon="schedule" label="Ζώνη ώρας" value={form.timezone || '—'} />
            <StatusChip
              icon={form.maintenance_mode ? 'engineering' : 'check_circle'}
              label="Κατάσταση"
              value={form.maintenance_mode ? 'Συντήρηση' : 'Ενεργό'}
              tone={form.maintenance_mode ? 'amber' : 'emerald'}
            />
          </div>
        </div>

        <nav className="flex gap-1.5 overflow-x-auto border-t border-black/[0.04] px-3 py-2.5 sm:px-4">
          {NAV_SECTIONS.map((item) => {
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollTo(item.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {form.maintenance_mode ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <span className="material-symbols-outlined text-amber-600 shrink-0">warning</span>
          <div>
            <p className="font-bold">Λειτουργία συντήρησης ενεργή</p>
            <p className="mt-0.5 text-xs text-amber-800/90">
              Οι πελάτες βλέπουν μήνυμα maintenance στο storefront μέχρι να την απενεργοποιήσεις.
            </p>
          </div>
        </div>
      ) : null}

      <SectionCard
        id="company"
        icon="business"
        title="Εταιρεία & locale"
        description="Επωνυμία, επικοινωνία, γλώσσα και timezone που χρησιμοποιεί το γραφείο."
        accent="bg-sky-600"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Επωνυμία" hint="Εμφανίζεται σε emails, τιμολόγια και admin header">
            <input
              type="text"
              value={form.company_name ?? ''}
              onChange={(e) => patch('company_name', e.target.value)}
              className={inputClass}
              autoComplete="organization"
            />
          </Field>
          <Field label="Email υποστήριξης" hint="Πού απαντάτε σε πελάτες">
            <input
              type="email"
              value={form.support_email ?? ''}
              onChange={(e) => patch('support_email', e.target.value)}
              className={inputClass}
              autoComplete="email"
            />
          </Field>
          <Field label="Γλώσσα" hint="Προεπιλογή UI & μορφοποίηση">
            <select
              value={form.default_locale || 'el-GR'}
              onChange={(e) => patch('default_locale', e.target.value)}
              className={inputClass}
            >
              {!LOCALES.some((l) => l.value === form.default_locale) && form.default_locale ? (
                <option value={form.default_locale}>{form.default_locale}</option>
              ) : null}
              {LOCALES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ζώνη ώρας" hint="Ώρες εκδρομών, digests, ειδοποιήσεις">
            <select
              value={form.timezone || 'Europe/Athens'}
              onChange={(e) => patch('timezone', e.target.value)}
              className={inputClass}
            >
              {!TIMEZONES.some((t) => t.value === form.timezone) && form.timezone ? (
                <option value={form.timezone}>{form.timezone}</option>
              ) : null}
              {TIMEZONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="md:col-span-2">
            <ToggleRow
              checked={Boolean(form.maintenance_mode)}
              onChange={(v) => patch('maintenance_mode', v)}
              title="Λειτουργία συντήρησης"
              hint="Κλείνει προσωρινά το storefront για πελάτες"
              danger
            />
          </div>
          <Field
            className="md:col-span-2"
            label="Checkout base URL"
            hint="Βάση για recovery links εγκαταλειμμένων κρατήσεων (χωρίς τελικό /)"
          >
            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="url"
                value={form.checkout_base_url ?? ''}
                onChange={(e) => patch('checkout_base_url', e.target.value)}
                placeholder="https://www.example.com"
                className={`${inputClass} mt-0 flex-1`}
              />
              <button
                type="button"
                onClick={useCurrentOrigin}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-[16px]">link</span>
                Τρέχον domain
              </button>
            </div>
            {String(form.checkout_base_url || '').includes('localhost') ? (
              <p className="mt-2 text-xs font-medium text-amber-700">
                Το URL δείχνει σε localhost — στα production recovery emails θα στέλνει λάθος σύνδεσμο.
              </p>
            ) : null}
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        id="abandoned"
        icon="shopping_cart_checkout"
        title="Εγκαταλειμμένες κρατήσεις"
        description="Πότε θεωρείται εκκρεμής ένα checkout και πόσο συχνά στέλνεται recovery."
        accent="bg-amber-500"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label="Εκκρεμείς μετά (λεπτά)"
            hint="Μετά από πόσα λεπτά χωρίς ολοκλήρωση ξεκινά recovery"
          >
            <input
              type="number"
              min={15}
              max={1440}
              value={form.abandoned_pending_minutes ?? ''}
              onChange={(e) =>
                patch('abandoned_pending_minutes', e.target.value === '' ? '' : Number(e.target.value))
              }
              className={inputClass}
            />
          </Field>
          <Field
            label="Cooldown recovery (ώρες)"
            hint="Ελάχιστο διάστημα πριν ξανασταλεί reminder στον ίδιο πελάτη"
          >
            <input
              type="number"
              min={1}
              max={168}
              value={form.abandoned_recovery_cooldown_hours ?? ''}
              onChange={(e) =>
                patch(
                  'abandoned_recovery_cooldown_hours',
                  e.target.value === '' ? '' : Number(e.target.value),
                )
              }
              className={inputClass}
            />
          </Field>
        </div>
        <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-xs text-amber-900">
          Τρέχων κανόνας: εκκρεμείς μετά από{' '}
          <strong>{form.abandoned_pending_minutes || 60} λεπτά</strong> · cooldown{' '}
          <strong>{form.abandoned_recovery_cooldown_hours || 24} ώρες</strong>.
        </div>
      </SectionCard>

      <SectionCard
        id="pricing"
        icon="sell"
        title="Δυναμική τιμολόγηση"
        description="Αυτόματο markup / έκπτωση ανάλογα με την πληρότητα της εκδρομής."
        accent="bg-violet-600"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Υψηλή πληρότητα από (%)" hint="Πάνω από αυτό το όριο εφαρμόζεται markup">
            <input
              type="number"
              min={50}
              max={100}
              step={5}
              value={pctFromRatio(form.pricing_high_occupancy_threshold)}
              onChange={(e) => patch('pricing_high_occupancy_threshold', ratioFromPct(e.target.value))}
              className={inputClass}
            />
          </Field>
          <Field label="Markup (%)" hint="Αύξηση τιμής όταν η πληρότητα είναι υψηλή">
            <input
              type="number"
              min={0}
              max={50}
              value={form.pricing_high_occupancy_markup_pct ?? ''}
              onChange={(e) =>
                patch(
                  'pricing_high_occupancy_markup_pct',
                  e.target.value === '' ? '' : Number(e.target.value),
                )
              }
              className={inputClass}
            />
          </Field>
          <Field label="Χαμηλή πληρότητα έως (%)" hint="Κάτω από αυτό το όριο εφαρμόζεται έκπτωση">
            <input
              type="number"
              min={0}
              max={50}
              step={5}
              value={pctFromRatio(form.pricing_low_occupancy_threshold)}
              onChange={(e) => patch('pricing_low_occupancy_threshold', ratioFromPct(e.target.value))}
              className={inputClass}
            />
          </Field>
          <Field label="Έκπτωση (%)" hint="Μείωση τιμής όταν η πληρότητα είναι χαμηλή">
            <input
              type="number"
              min={0}
              max={30}
              value={form.pricing_low_occupancy_discount_pct ?? ''}
              onChange={(e) =>
                patch(
                  'pricing_low_occupancy_discount_pct',
                  e.target.value === '' ? '' : Number(e.target.value),
                )
              }
              className={inputClass}
            />
          </Field>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-violet-100 bg-violet-50/70 px-4 py-3 text-xs text-violet-900">
            ≥ {pctFromRatio(form.pricing_high_occupancy_threshold) || 80}% πληρότητα → +
            {form.pricing_high_occupancy_markup_pct ?? 10}% τιμή
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-900">
            ≤ {pctFromRatio(form.pricing_low_occupancy_threshold) || 30}% πληρότητα → −
            {form.pricing_low_occupancy_discount_pct ?? 5}% τιμή
          </div>
        </div>
      </SectionCard>

      <SectionCard
        id="notify"
        icon="mail"
        title="Ειδοποιήσεις & integrations"
        description="SMTP, SMS sender, Master QR διάρκεια και retries για webhooks."
        accent="bg-emerald-600"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Master QR TTL (ώρες)" hint="Πόσο διαρκεί το master QR πριν λήξει">
            <input
              type="number"
              min={1}
              max={168}
              value={form.master_qr_ttl_hours ?? ''}
              onChange={(e) =>
                patch('master_qr_ttl_hours', e.target.value === '' ? '' : Number(e.target.value))
              }
              className={inputClass}
            />
          </Field>
          <Field label="Webhook retries" hint="Επαναλήψεις σε αποτυχία partner webhook">
            <input
              type="number"
              min={1}
              max={20}
              value={form.webhook_max_retries ?? ''}
              onChange={(e) =>
                patch('webhook_max_retries', e.target.value === '' ? '' : Number(e.target.value))
              }
              className={inputClass}
            />
          </Field>
          <Field label="SMTP From" hint="Διεύθυνση αποστολέα στα transactional emails">
            <input
              type="email"
              value={form.smtp_from_email ?? ''}
              onChange={(e) => patch('smtp_from_email', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="SMS Sender ID" hint="Όνομα αποστολέα SMS (έως 11 χαρακτήρες συνήθως)">
            <input
              type="text"
              maxLength={16}
              value={form.sms_sender_id ?? ''}
              onChange={(e) => patch('sms_sender_id', e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </SectionCard>

      <section
        id="payments"
        className="scroll-mt-28 overflow-hidden rounded-[24px] border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-white to-sky-50/40 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <div className="flex items-start gap-3 min-w-0">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-sm">
              <span className="material-symbols-outlined text-[22px]">account_balance</span>
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-[17px]">Διαχείριση πληρωμών</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-xl leading-relaxed">
                Τρόποι πληρωμής, προκαταβολή, τραπεζικοί λογαριασμοί και επιβεβαίωση καταθέσεων —
                στην ενότητα «Πληρωμές».
              </p>
            </div>
          </div>
          {onOpenPayments ? (
            <button
              type="button"
              onClick={onOpenPayments}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90"
            >
              Άνοιγμα Πληρωμών
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          ) : null}
        </div>
      </section>

      <AbandonedRecoveryPanel pendingMinutes={form.abandoned_pending_minutes} />

      <div
        className={`sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-md transition ${
          dirty
            ? 'border-amber-200 bg-white/95'
            : 'border-slate-200 bg-white/90'
        }`}
      >
        <div className="text-xs font-medium text-slate-600">
          {saving ? (
            <span className="text-slate-500">Αποθήκευση σε εξέλιξη…</span>
          ) : dirty ? (
            <span className="text-amber-800">Υπάρχουν μη αποθηκευμένες αλλαγές</span>
          ) : lastSavedAt ? (
            <span className="text-emerald-700">
              Αποθηκεύτηκε{' '}
              {lastSavedAt.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : (
            <span>Όλα αποθηκευμένα</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving || !dirty}
            onClick={load}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Απόρριψη
          </button>
          <button
            type="submit"
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">save</span>
            {saving ? 'Αποθήκευση…' : 'Αποθήκευση γραφείου'}
          </button>
        </div>
      </div>
    </form>
  );
}
