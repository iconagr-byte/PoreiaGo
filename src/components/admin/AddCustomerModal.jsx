import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { upsertCustomer } from '../../lib/customers/customerStore.js';

const TIER_OPTIONS = [
  { id: 'Silver', label: 'Silver', hint: 'Βασικό' },
  { id: 'Gold', label: 'Gold', hint: 'Τακτικός' },
  { id: 'Platinum', label: 'Platinum', hint: 'Premium' },
  { id: 'VIP', label: 'VIP', hint: 'Προτεραιότητα' },
];

const TAG_PRESETS = ['Εταιρικός', 'Οικογένεια', 'Επαναλαμβανόμενος', 'Influencer'];
const SOURCE_OPTIONS = [
  { id: 'manual', label: 'Χειροκίνητα' },
  { id: 'phone', label: 'Τηλέφωνο' },
  { id: 'walk_in', label: 'Επίσκεψη στο γραφείο' },
  { id: 'website', label: 'Website / κράτηση' },
  { id: 'referral', label: 'Σύσταση' },
  { id: 'social', label: 'Social media' },
];

const fieldClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 placeholder:text-slate-400';

function Field({ label, required, hint, children, className = '' }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="block text-xs font-semibold text-slate-600 mb-1.5">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="block text-[11px] text-slate-400 mt-1">{hint}</span> : null}
    </label>
  );
}

const EMPTY = {
  name: '',
  email: '',
  phone: '',
  company: '',
  afm: '',
  city: '',
  address: '',
  notes: '',
  tier: 'Silver',
  source: 'manual',
  marketingOptIn: true,
  tags: [],
};

function formFromCustomer(customer) {
  if (!customer) return EMPTY;
  return {
    name: customer.name || '',
    email: customer.email || '',
    phone: customer.phone || '',
    company: customer.company || '',
    afm: customer.afm || '',
    city: customer.city || '',
    address: customer.address || '',
    notes: customer.notes || '',
    tier: customer.tier || 'Silver',
    source: customer.source || 'manual',
    marketingOptIn: customer.marketingOptIn !== false,
    tags: Array.isArray(customer.tags) ? [...customer.tags] : [],
  };
}

/** Modal — δημιουργία / επεξεργασία πελάτη στο πελατολόγιο. */
export default function AddCustomerModal({
  open,
  onClose,
  onCreated,
  customer = null,
  serviceScope = 'buses',
}) {
  const [form, setForm] = useState(EMPTY);
  const [tagDraft, setTagDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('main'); // main | extra
  const isEdit = Boolean(customer?.id || customer?.email);

  useEffect(() => {
    if (!open) return;
    setForm(formFromCustomer(customer));
    setTagDraft('');
    setBusy(false);
    setStep('main');
  }, [open, customer]);

  if (!open) return null;

  const patch = (partial) => setForm((prev) => ({ ...prev, ...partial }));

  const addTag = (raw) => {
    const value = String(raw || '').trim();
    if (!value) return;
    if (form.tags.some((t) => t.toLowerCase() === value.toLowerCase())) {
      setTagDraft('');
      return;
    }
    patch({ tags: [...form.tags, value] });
    setTagDraft('');
  };

  const removeTag = (value) => patch({ tags: form.tags.filter((t) => t !== value) });

  const submit = (e) => {
    e.preventDefault();
    const cleanEmail = form.email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      toast.error('Συμπληρώστε έγκυρο email');
      setStep('main');
      return;
    }
    if (form.afm && !/^\d{9}$/.test(form.afm.replace(/\s/g, ''))) {
      toast.error('Το ΑΦΜ πρέπει να έχει 9 ψηφία');
      setStep('extra');
      return;
    }
    setBusy(true);
    try {
      const row = upsertCustomer({
        id: customer?.id,
        name: form.name.trim() || cleanEmail.split('@')[0],
        email: cleanEmail,
        phone: form.phone.trim(),
        company: form.company.trim(),
        afm: form.afm.replace(/\s/g, ''),
        city: form.city.trim(),
        address: form.address.trim(),
        notes: form.notes.trim(),
        tier: form.tier,
        source: form.source,
        serviceScope: customer?.serviceScope || serviceScope,
        marketingOptIn: form.marketingOptIn,
        tags: form.tags,
      });
      if (!row) {
        toast.error('Αποτυχία αποθήκευσης');
        return;
      }
      toast.success(isEdit ? `Ενημερώθηκε: ${row.name}` : `Προστέθηκε: ${row.name}`);
      onCreated?.(row);
      onClose?.();
    } catch (err) {
      toast.error(err?.message || 'Αποτυχία');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" aria-label="Κλείσιμο" onClick={onClose} />

      <form
        onSubmit={submit}
        className="relative w-full sm:max-w-xl max-h-[92vh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-black/[0.06] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">{isEdit ? 'edit' : 'person_add'}</span>
            </span>
            <div className="min-w-0">
              <h3 className="text-lg font-bold tracking-tight text-slate-900">
                {isEdit ? 'Επεξεργασία πελάτη' : 'Νέος πελάτης'}
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">
                {isEdit ? 'Ενημέρωση καρτέλας στο πελατολόγιο' : 'Καρτέλα στο πελατολόγιο του γραφείου'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 flex gap-1.5 border-b border-slate-100">
          {[
            { id: 'main', label: 'Στοιχεία', icon: 'badge' },
            { id: 'extra', label: 'Επιπλέον', icon: 'tune' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setStep(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold border-b-2 -mb-px transition ${
                step === t.id
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {step === 'main' && (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Ονοματεπώνυμο" className="sm:col-span-2">
                  <input
                    className={fieldClass}
                    value={form.name}
                    onChange={(e) => patch({ name: e.target.value })}
                    placeholder="π.χ. Μαρία Παπαδοπούλου"
                    autoFocus
                  />
                </Field>
                <Field
                  label="Email"
                  required
                  className="sm:col-span-2"
                  hint={isEdit ? 'Το email δεν αλλάζει — είναι το κλειδί της καρτέλας.' : undefined}
                >
                  <input
                    type="email"
                    required
                    disabled={isEdit}
                    className={`${fieldClass} ${isEdit ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                    value={form.email}
                    onChange={(e) => patch({ email: e.target.value })}
                    placeholder="maria@email.com"
                  />
                </Field>
                <Field label="Τηλέφωνο">
                  <input
                    className={fieldClass}
                    value={form.phone}
                    onChange={(e) => patch({ phone: e.target.value })}
                    placeholder="69xxxxxxxx"
                    inputMode="tel"
                  />
                </Field>
                <Field label="Πόλη">
                  <input
                    className={fieldClass}
                    value={form.city}
                    onChange={(e) => patch({ city: e.target.value })}
                    placeholder="π.χ. Αθήνα"
                  />
                </Field>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">Tier / επίπεδο</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TIER_OPTIONS.map((t) => {
                    const on = form.tier === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => patch({ tier: t.id })}
                        className={`rounded-xl border px-2.5 py-2.5 text-left transition ${
                          on
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <span className="block text-xs font-bold">{t.label}</span>
                        <span className={`block text-[10px] mt-0.5 ${on ? 'text-white/70' : 'text-slate-400'}`}>
                          {t.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {step === 'extra' && (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Εταιρεία / επωνυμία">
                  <input
                    className={fieldClass}
                    value={form.company}
                    onChange={(e) => patch({ company: e.target.value })}
                    placeholder="προαιρετικό"
                  />
                </Field>
                <Field label="ΑΦΜ" hint="9 ψηφία">
                  <input
                    className={fieldClass}
                    value={form.afm}
                    onChange={(e) => patch({ afm: e.target.value.replace(/[^\d]/g, '').slice(0, 9) })}
                    placeholder="123456789"
                    inputMode="numeric"
                  />
                </Field>
                <Field label="Διεύθυνση" className="sm:col-span-2">
                  <input
                    className={fieldClass}
                    value={form.address}
                    onChange={(e) => patch({ address: e.target.value })}
                    placeholder="Οδός, αριθμός"
                  />
                </Field>
                <Field label="Πηγή" className="sm:col-span-2">
                  <select
                    className={fieldClass}
                    value={form.source}
                    onChange={(e) => patch({ source: e.target.value })}
                  >
                    {SOURCE_OPTIONS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">Ετικέτες</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {TAG_PRESETS.map((t) => {
                    const on = form.tags.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => (on ? removeTag(t) : addTag(t))}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                          on
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <input
                    className={fieldClass}
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag(tagDraft);
                      }
                    }}
                    placeholder="Νέα ετικέτα + Enter"
                  />
                  <button
                    type="button"
                    onClick={() => addTag(tagDraft)}
                    className="shrink-0 px-3 rounded-xl bg-slate-100 text-xs font-bold text-slate-700"
                  >
                    +
                  </button>
                </div>
                {form.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                      >
                        {t}
                        <button type="button" onClick={() => removeTag(t)} className="text-slate-400 hover:text-rose-600">
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <Field label="Σημειώσεις">
                <textarea
                  rows={3}
                  className={`${fieldClass} resize-y min-h-[80px]`}
                  value={form.notes}
                  onChange={(e) => patch({ notes: e.target.value })}
                  placeholder="Προτιμήσεις, αλλεργίες, σχόλια γραφείου…"
                />
              </Field>

              <button
                type="button"
                onClick={() => patch({ marketingOptIn: !form.marketingOptIn })}
                className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  form.marketingOptIn
                    ? 'border-slate-900/15 bg-slate-900/[0.03]'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">Newsletter / προσφορές</p>
                  <p className="text-xs text-slate-500 mt-0.5">Συγκατάθεση για email marketing</p>
                </div>
                <span
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    form.marketingOptIn ? 'bg-slate-900' : 'bg-slate-300'
                  }`}
                  aria-hidden
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      form.marketingOptIn ? 'translate-x-5' : ''
                    }`}
                  />
                </span>
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep(step === 'main' ? 'extra' : 'main')}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
          >
            {step === 'main' ? (
              <>
                Περισσότερα
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                Βασικά
              </>
            )}
          </button>
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Άκυρο
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">
                {busy ? 'hourglass_empty' : 'save'}
              </span>
              Αποθήκευση
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
