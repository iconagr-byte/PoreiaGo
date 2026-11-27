/**
 * Office admin — configure the /rent newsletter strip under the services mosaic.
 * Email + consent CTA only (no interest checkboxes).
 */
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import RentNewsletterStripFields, {
  ensureRentNewsletterStripForm,
} from './RentNewsletterStripFields.jsx';
import {
  fetchAdminSiteAppearance,
  updateSiteAppearance,
} from '../../../services/siteAppearanceApi.js';

export default function RentNewsletterStripEditor({ embedded = false, onSaved } = {}) {
  const [form, setForm] = useState(() => ensureRentNewsletterStripForm({}));
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminSiteAppearance();
      const next = ensureRentNewsletterStripForm(data);
      setForm(next);
      setSaved(JSON.stringify(next));
    } catch (err) {
      toast.error(err.message || 'Αποτυχία φόρτωσης');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = JSON.stringify(ensureRentNewsletterStripForm(form)) !== saved;

  const save = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      const normalized = ensureRentNewsletterStripForm(form);
      const patch = {
        rent_newsletter_enabled: Boolean(normalized.rent_newsletter_enabled),
        rent_newsletter_title: String(normalized.rent_newsletter_title || '').trim(),
        rent_newsletter_image_url: String(normalized.rent_newsletter_image_url || '').trim(),
        rent_newsletter_panel_color: String(normalized.rent_newsletter_panel_color || '').trim(),
        rent_newsletter_button_label: String(
          normalized.rent_newsletter_button_label || '',
        ).trim(),
        rent_newsletter_email_placeholder: String(
          normalized.rent_newsletter_email_placeholder || '',
        ).trim(),
        // Clear any previously saved interest checkboxes.
        rent_newsletter_interests: [],
      };
      const result = await updateSiteAppearance(patch);
      const next = ensureRentNewsletterStripForm(result?.data || { ...form, ...patch });
      setForm(next);
      setSaved(JSON.stringify(next));
      onSaved?.(result?.data || patch);
      toast.success('Το newsletter στο /rent αποθηκεύτηκε');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500">Φόρτωση…</p>;
  }

  return (
    <form
      onSubmit={save}
      className={
        embedded ? 'space-y-4' : 'space-y-4 rounded-2xl border border-teal-100 bg-white p-4 sm:p-5'
      }
    >
      {!embedded ? (
        <div>
          <h3 className="text-base font-bold text-slate-900">Newsletter κάτω από τις υπηρεσίες</h3>
          <p className="mt-1 text-sm text-slate-500">
            Φωτό + φόρμα εγγραφής στο /rent. Δικά σας κείμενα και χρώμα panel. Οι εγγραφές
            δένονται στο γραφείο (Host) και εμφανίζονται στους συνδρομητές email.
          </p>
        </div>
      ) : null}

      <RentNewsletterStripFields form={form} setForm={setForm} />

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={!dirty || saving}
          className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {saving ? 'Αποθήκευση…' : 'Αποθήκευση newsletter'}
        </button>
        {dirty ? (
          <span className="text-xs font-semibold text-amber-700">Μη αποθηκευμένες αλλαγές</span>
        ) : null}
      </div>
    </form>
  );
}
