/**
 * Controlled fields for /rent newsletter strip — desk editor + Page Studio.
 */
import ImageDropField from '../ImageDropField.jsx';
import {
  DEFAULT_RENT_NEWSLETTER,
  resolveRentNewsletterStrip,
} from '../../../lib/rental/rentNewsletterStrip.js';
import { uploadSiteAsset } from '../../../services/siteAppearanceApi.js';

/** Normalize appearance-shaped form for editing. */
export function ensureRentNewsletterStripForm(form = {}) {
  const resolved = resolveRentNewsletterStrip(form);
  return {
    rent_newsletter_enabled: form.rent_newsletter_enabled !== false,
    rent_newsletter_title: form.rent_newsletter_title ?? resolved.title,
    rent_newsletter_image_url: form.rent_newsletter_image_url ?? resolved.image_url,
    rent_newsletter_panel_color: form.rent_newsletter_panel_color ?? resolved.panel_color,
    rent_newsletter_button_label:
      form.rent_newsletter_button_label ?? resolved.button_label,
    rent_newsletter_email_placeholder:
      form.rent_newsletter_email_placeholder ?? resolved.email_placeholder,
  };
}

export default function RentNewsletterStripFields({
  form,
  setForm,
  compact = false,
}) {
  const strip = ensureRentNewsletterStripForm(form);
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

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <input
          type="checkbox"
          checked={Boolean(strip.rent_newsletter_enabled)}
          onChange={(e) => setField('rent_newsletter_enabled', e.target.checked)}
        />
        Εμφάνιση newsletter στο /rent
      </label>

      <label className="block text-sm">
        <span className="font-semibold text-slate-700">Τίτλος</span>
        <textarea
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
          rows={compact ? 2 : 3}
          value={strip.rent_newsletter_title}
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
              value={strip.rent_newsletter_panel_color || DEFAULT_RENT_NEWSLETTER.panel_color}
              onChange={(e) => setField('rent_newsletter_panel_color', e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
              value={strip.rent_newsletter_panel_color}
              onChange={(e) => setField('rent_newsletter_panel_color', e.target.value)}
              placeholder="#dff3ee"
            />
          </div>
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-slate-700">Κείμενο κουμπιού</span>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={strip.rent_newsletter_button_label}
            onChange={(e) => setField('rent_newsletter_button_label', e.target.value)}
            placeholder={DEFAULT_RENT_NEWSLETTER.button_label}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-semibold text-slate-700">Placeholder email</span>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={strip.rent_newsletter_email_placeholder}
            onChange={(e) => setField('rent_newsletter_email_placeholder', e.target.value)}
            placeholder={DEFAULT_RENT_NEWSLETTER.email_placeholder}
          />
        </label>
      </div>

      <ImageDropField
        label="Φωτογραφία αριστερά"
        hint="Lifestyle / ταξίδι — πραγματική φωτό, όχι mockup"
        value={strip.rent_newsletter_image_url}
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
    </div>
  );
}
