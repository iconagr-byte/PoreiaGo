/**
 * Office admin — configure the /rent newsletter strip under the services mosaic.
 */
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import ImageDropField from '../ImageDropField.jsx';
import {
  DEFAULT_RENT_NEWSLETTER,
  DEFAULT_RENT_NEWSLETTER_INTERESTS,
  RENT_NEWSLETTER_INTERESTS_MAX,
  normalizeRentNewsletterInterest,
  resolveRentNewsletterStrip,
} from '../../../lib/rental/rentNewsletterStrip.js';
import {
  fetchAdminSiteAppearance,
  updateSiteAppearance,
  uploadSiteAsset,
} from '../../../services/siteAppearanceApi.js';

function blankInterest() {
  return {
    id: `interest-${Date.now()}`,
    label: '',
  };
}

function formFromAppearance(data) {
  const strip = resolveRentNewsletterStrip(data || {});
  return {
    rent_newsletter_enabled: strip.enabled,
    rent_newsletter_title: strip.title,
    rent_newsletter_image_url: strip.image_url,
    rent_newsletter_panel_color: strip.panel_color,
    rent_newsletter_button_label: strip.button_label,
    rent_newsletter_email_placeholder: strip.email_placeholder,
    rent_newsletter_interests: strip.interests.map((row) => ({ ...row })),
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

  const updateInterest = (index, patch) => {
    setForm((p) => ({
      ...p,
      rent_newsletter_interests: p.rent_newsletter_interests.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    }));
  };

  const addInterest = () => {
    setForm((p) => {
      if (p.rent_newsletter_interests.length >= RENT_NEWSLETTER_INTERESTS_MAX) return p;
      return {
        ...p,
        rent_newsletter_interests: [...p.rent_newsletter_interests, blankInterest()],
      };
    });
  };

  const removeInterest = (index) => {
    setForm((p) => ({
      ...p,
      rent_newsletter_interests: p.rent_newsletter_interests.filter((_, i) => i !== index),
    }));
  };

  const resetDefaults = () => {
    setForm((p) => ({
      ...p,
      rent_newsletter_title: DEFAULT_RENT_NEWSLETTER.title,
      rent_newsletter_image_url: DEFAULT_RENT_NEWSLETTER.image_url,
      rent_newsletter_panel_color: DEFAULT_RENT_NEWSLETTER.panel_color,
      rent_newsletter_button_label: DEFAULT_RENT_NEWSLETTER.button_label,
      rent_newsletter_email_placeholder: DEFAULT_RENT_NEWSLETTER.email_placeholder,
      rent_newsletter_interests: DEFAULT_RENT_NEWSLETTER_INTERESTS.map((row) => ({ ...row })),
    }));
  };

  const save = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      const interests = form.rent_newsletter_interests
        .map((row, i) => normalizeRentNewsletterInterest(row, i))
        .filter(Boolean);
      const patch = {
        rent_newsletter_enabled: Boolean(form.rent_newsletter_enabled),
        rent_newsletter_title: String(form.rent_newsletter_title || '').trim(),
        rent_newsletter_image_url: String(form.rent_newsletter_image_url || '').trim(),
        rent_newsletter_panel_color: String(form.rent_newsletter_panel_color || '').trim(),
        rent_newsletter_button_label: String(form.rent_newsletter_button_label || '').trim(),
        rent_newsletter_email_placeholder: String(
          form.rent_newsletter_email_placeholder || '',
        ).trim(),
        rent_newsletter_interests: interests,
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
            Φωτό + φόρμα εγγραφής στο /rent. Δικά σας κείμενα και χρώμα panel — όχι κίτρινο clone.
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
          className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-bold text-teal-900 hover:bg-teal-100 disabled:opacity-50"
          onClick={addInterest}
          disabled={form.rent_newsletter_interests.length >= RENT_NEWSLETTER_INTERESTS_MAX}
        >
          + Ενδιαφέρον
        </button>
        <button
          type="button"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          onClick={resetDefaults}
        >
          Επαναφορά προεπιλογών
        </button>
      </div>

      <div className="space-y-3">
        {form.rent_newsletter_interests.map((row, index) => (
          <div
            key={row.id || index}
            className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3"
          >
            <label className="min-w-[12rem] flex-1 text-sm">
              <span className="font-semibold text-slate-700">Επιλογή {index + 1}</span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                value={row.label}
                onChange={(e) => updateInterest(index, { label: e.target.value })}
                placeholder="π.χ. Ενοικίαση αυτοκινήτου"
              />
            </label>
            <button
              type="button"
              className="text-sm font-semibold text-rose-600 hover:underline"
              onClick={() => removeInterest(index)}
            >
              Διαγραφή
            </button>
          </div>
        ))}
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
