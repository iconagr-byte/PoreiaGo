/**
 * Office admin — configure the /rent newsletter strip under the services mosaic.
 * Email + consent CTA only (no interest checkboxes).
 */
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import ImageDropField from '../ImageDropField.jsx';
import {
  DEFAULT_RENT_NEWSLETTER,
  resolveRentNewsletterStrip,
} from '../../../lib/rental/rentNewsletterStrip.js';
import {
  fetchAdminSiteAppearance,
  updateSiteAppearance,
  uploadSiteAsset,
} from '../../../services/siteAppearanceApi.js';

function formFromAppearance(data) {
  const strip = resolveRentNewsletterStrip(data || {});
  return {
    rent_newsletter_enabled: strip.enabled,
    rent_newsletter_title: strip.title,
    rent_newsletter_image_url: strip.image_url,
    rent_newsletter_panel_color: strip.panel_color,
    rent_newsletter_button_label: strip.button_label,
    rent_newsletter_email_placeholder: strip.email_placeholder,
  };
}

export default function RentNewsletterStripEditor({ embedded = false, onSaved } = {}) {
  const [form, setForm] = useState(() => formFromAppearance(null));
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminSiteAppearance();
      const next = formFromAppearance(data);
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

  const dirty = JSON.stringify(form) !== saved;

  const setField = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const resetDefaults = () => {
    setForm((p) => ({
      ...p,
      rent_newsletter_title: DEFAULT_RENT_NEWSLETTER.title,
      rent_newsletter_image_url: DEFAULT_RENT_NEWSLETTER.image_url,
      rent_newsletter_panel_color: DEFAULT_RENT_NEWSLETTER.panel_color,
      rent_newsletter_button_label: DEFAULT_RENT_NEWSLETTER.button_label,
      rent_newsletter_email_placeholder: DEFAULT_RENT_NEWSLETTER.email_placeholder,
    }));
  };

  const save = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      const patch = {
        rent_newsletter_enabled: Boolean(form.rent_newsletter_enabled),
        rent_newsletter_title: String(form.rent_newsletter_title || '').trim(),
        rent_newsletter_image_url: String(form.rent_newsletter_image_url || '').trim(),
        rent_newsletter_panel_color: String(form.rent_newsletter_panel_color || '').trim(),
        rent_newsletter_button_label: String(form.rent_newsletter_button_label || '').trim(),
        rent_newsletter_email_placeholder: String(
          form.rent_newsletter_email_placeholder || '',
        ).trim(),
        // Clear any previously saved interest checkboxes.
        rent_newsletter_interests: [],
      };
      const result = await updateSiteAppearance(patch);
      const next = formFromAppearance(result?.data || { ...form, ...patch });
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
            Φωτό + φόρμα εγγραφής στο /rent. Δικά σας κείμενα και χρώμα panel — χωρίς επιλογές ενδιαφερόντων.
          </p>
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <input
          type="checkbox"
          checked={Boolean(form.rent_newsletter_enabled)}
          onChange={(e) => setField('rent_newsletter_enabled', e.target.checked)}
        />
        Εμφάνιση newsletter στο /rent
      </label>

      <label className="block text-sm">
        <span className="font-semibold text-slate-700">Τίτλος</span>
        <textarea
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
          rows={3}
          value={form.rent_newsletter_title}
          onChange={(e) => setField('rent_newsletter_title', e.target.value)}
          placeholder={DEFAULT_RENT_NEWSLETTER.title}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-semibold text-slate-700">Χρώμα panel</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              className="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
              value={form.rent_newsletter_panel_color || DEFAULT_RENT_NEWSLETTER.panel_color}
              onChange={(e) => setField('rent_newsletter_panel_color', e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
              value={form.rent_newsletter_panel_color}
              onChange={(e) => setField('rent_newsletter_panel_color', e.target.value)}
              placeholder="#dff3ee"
            />
          </div>
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-slate-700">Κείμενο κουμπιού</span>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={form.rent_newsletter_button_label}
            onChange={(e) => setField('rent_newsletter_button_label', e.target.value)}
            placeholder={DEFAULT_RENT_NEWSLETTER.button_label}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-semibold text-slate-700">Placeholder email</span>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={form.rent_newsletter_email_placeholder}
            onChange={(e) => setField('rent_newsletter_email_placeholder', e.target.value)}
            placeholder={DEFAULT_RENT_NEWSLETTER.email_placeholder}
          />
        </label>
      </div>

      <ImageDropField
        label="Φωτογραφία αριστερά"
        hint="Lifestyle / ταξίδι — πραγματική φωτό, όχι mockup"
        value={form.rent_newsletter_image_url}
        onChange={(url) => setField('rent_newsletter_image_url', url)}
        onUpload={async (file) => {
          const result = await uploadSiteAsset('rent_newsletter', file);
          return result?.url || result;
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          onClick={resetDefaults}
        >
          Επαναφορά προεπιλογών
        </button>
      </div>

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
