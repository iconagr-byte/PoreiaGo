import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  DEFAULT_RENT_NOTIFY,
  readRentNotifySettings,
  rentNotifyPatchFromForm,
} from '../../../lib/rental/rentNotify.js';
import {
  fetchSiteAppearance,
  updateSiteAppearance,
} from '../../../services/siteAppearanceApi.js';

function settingsToForm(appearance) {
  const s = readRentNotifySettings(appearance);
  return {
    emailEnabled: s.emailEnabled,
    smsEnabled: s.smsEnabled,
    emailLabel: s.emailLabel,
    smsLabel: s.smsLabel,
    emailDefault: s.emailDefault,
    smsDefault: s.smsDefault,
    smsTemplateConfirmed: s.smsTemplateConfirmed,
    smsTemplateStatus: s.smsTemplateStatus,
    emailSubject: s.emailSubject,
    emailBody: s.emailBody,
  };
}

/**
 * Admin control for rent checkout email/SMS consent + templates.
 */
export default function RentNotificationsEditor() {
  const [form, setForm] = useState(() => settingsToForm(DEFAULT_RENT_NOTIFY));
  const [baseline, setBaseline] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(rentNotifyPatchFromForm(form)) !== baseline,
    [form, baseline],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSiteAppearance();
      const next = settingsToForm(data);
      setForm(next);
      setBaseline(JSON.stringify(rentNotifyPatchFromForm(next)));
    } catch (err) {
      toast.error(err.message || 'Αποτυχία φόρτωσης');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const patch = rentNotifyPatchFromForm(form);
      await updateSiteAppearance(patch);
      setBaseline(JSON.stringify(patch));
      toast.success('Οι ρυθμίσεις ειδοποιήσεων αποθηκεύτηκαν');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500 py-8">Φόρτωση ειδοποιήσεων…</p>;
  }

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700/80 mb-1">
            Checkout · Email & SMS
          </p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Ειδοποιήσεις</h2>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            Έλεγχος των checkboxes στο booking, προεπιλογές, κείμενα και templates SMS/email όταν ο
            πελάτης συναινεί.
          </p>
        </div>
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={save}
          className="inline-flex items-center gap-1.5 rounded-full bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-600 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">save</span>
          {saving ? 'Αποθήκευση…' : dirty ? 'Αποθήκευση' : 'Αποθηκευμένο'}
        </button>
      </header>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-700">mail</span>
            <h3 className="font-bold text-slate-900">Email προσφορές</h3>
          </div>
          <label className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
            <input
              type="checkbox"
              checked={form.emailEnabled}
              onChange={(e) => set('emailEnabled', e.target.checked)}
              className="mt-1 rounded border-gray-300"
            />
            <span>
              <span className="font-bold text-slate-800 block text-sm">Εμφάνιση checkbox</span>
              <span className="text-xs text-slate-500">
                Αν είναι off, το checkbox κρύβεται στο checkout.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
            <input
              type="checkbox"
              checked={form.emailDefault}
              onChange={(e) => set('emailDefault', e.target.checked)}
              className="mt-1 rounded border-gray-300"
              disabled={!form.emailEnabled}
            />
            <span>
              <span className="font-bold text-slate-800 block text-sm">Προεπιλογή checked</span>
              <span className="text-xs text-slate-500">Ο πελάτης μπορεί να το αλλάξει.</span>
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-bold text-slate-700 text-xs">Κείμενο checkbox</span>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={form.emailLabel}
              onChange={(e) => set('emailLabel', e.target.value)}
              disabled={!form.emailEnabled}
            />
          </label>
          <label className="block text-sm">
            <span className="font-bold text-slate-700 text-xs">Θέμα email επιβεβαίωσης</span>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={form.emailSubject}
              onChange={(e) => set('emailSubject', e.target.value)}
              disabled={!form.emailEnabled}
            />
          </label>
          <label className="block text-sm">
            <span className="font-bold text-slate-700 text-xs">Σώμα email (HTML)</span>
            <textarea
              className="mt-1 w-full rounded-xl border px-3 py-2 min-h-[7rem] font-mono text-xs"
              value={form.emailBody}
              onChange={(e) => set('emailBody', e.target.value)}
              disabled={!form.emailEnabled}
            />
          </label>
        </section>

        <section className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-700">sms</span>
            <h3 className="font-bold text-slate-900">SMS ενημερώσεις κράτησης</h3>
          </div>
          <label className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
            <input
              type="checkbox"
              checked={form.smsEnabled}
              onChange={(e) => set('smsEnabled', e.target.checked)}
              className="mt-1 rounded border-gray-300"
            />
            <span>
              <span className="font-bold text-slate-800 block text-sm">Εμφάνιση checkbox</span>
              <span className="text-xs text-slate-500">
                Με συναίνεση στέλνεται SMS επιβεβαίωσης και αλλαγής κατάστασης (Twilio).
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
            <input
              type="checkbox"
              checked={form.smsDefault}
              onChange={(e) => set('smsDefault', e.target.checked)}
              className="mt-1 rounded border-gray-300"
              disabled={!form.smsEnabled}
            />
            <span>
              <span className="font-bold text-slate-800 block text-sm">Προεπιλογή checked</span>
              <span className="text-xs text-slate-500">Ο πελάτης μπορεί να το αλλάξει.</span>
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-bold text-slate-700 text-xs">Κείμενο checkbox</span>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={form.smsLabel}
              onChange={(e) => set('smsLabel', e.target.value)}
              disabled={!form.smsEnabled}
            />
          </label>
          <label className="block text-sm">
            <span className="font-bold text-slate-700 text-xs">SMS επιβεβαίωσης</span>
            <textarea
              className="mt-1 w-full rounded-xl border px-3 py-2 min-h-[4.5rem]"
              value={form.smsTemplateConfirmed}
              onChange={(e) => set('smsTemplateConfirmed', e.target.value)}
              disabled={!form.smsEnabled}
            />
          </label>
          <label className="block text-sm">
            <span className="font-bold text-slate-700 text-xs">SMS αλλαγής κατάστασης</span>
            <textarea
              className="mt-1 w-full rounded-xl border px-3 py-2 min-h-[4.5rem]"
              value={form.smsTemplateStatus}
              onChange={(e) => set('smsTemplateStatus', e.target.value)}
              disabled={!form.smsEnabled}
            />
          </label>
        </section>
      </div>

      <div className="rounded-2xl border border-teal-100 bg-teal-50/50 px-4 py-3 text-sm text-teal-950/80">
        <p className="font-bold mb-1">Placeholders</p>
        <p className="text-xs">
          {'{ref} {name} {pickup} {start} {end} {status} {plate} {office}'}
        </p>
        <p className="text-xs mt-2">
          Το SMS χρειάζεται ρυθμισμένο Twilio στις Integrations. Χωρίς SMTP/Twilio τα μηνύματα
          καταγράφονται στο log και η κράτηση ολο ολο.
        </p>
      </div>

      <section className="rounded-2xl border border-dashed border-slate-200 bg-white p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-3">
          Προεπισκόπηση checkout
        </p>
        <div className="space-y-2 max-w-md">
          {form.emailEnabled ? (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.emailDefault} readOnly className="rounded" />
              {form.emailLabel}
            </label>
          ) : null}
          {form.smsEnabled ? (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.smsDefault} readOnly className="rounded" />
              {form.smsLabel}
            </label>
          ) : null}
          {!form.emailEnabled && !form.smsEnabled ? (
            <p className="text-sm text-slate-500">Και τα δύο κανάλια είναι ανενεργά — κανένα checkbox.</p>
          ) : null}
        </div>
      </section>

      {dirty ? (
        <div className="sticky bottom-3 z-10 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="inline-flex items-center gap-1.5 rounded-full bg-teal-700 px-5 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-60"
          >
            Αποθήκευση αλλαγών
          </button>
        </div>
      ) : null}
    </div>
  );
}
