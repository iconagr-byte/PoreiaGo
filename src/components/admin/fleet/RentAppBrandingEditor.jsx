/**
 * First-run / editable Rent app branding — office name + hero copy with live preview.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  DEFAULT_RENT_APP_BRANDING,
  resolveRentAppBranding,
} from '../../../lib/rental/rentAppBranding.js';
import {
  fetchAdminSiteAppearance,
  updateSiteAppearance,
} from '../../../services/siteAppearanceApi.js';

const FIELDS = [
  {
    key: 'rent_office_name',
    label: 'Όνομα γραφείου ενοικίασης',
    hint: 'Εμφανίζεται πάνω στον τίτλο της σελίδας /rent',
    placeholder: 'π.χ. Achillio Rent',
  },
  {
    key: 'rent_hero_title',
    label: 'Τίτλος (μετά τη σύνδεση)',
    hint: 'Μεγάλο κείμενο κάτω από το όνομα',
    placeholder: DEFAULT_RENT_APP_BRANDING.rent_hero_title,
  },
  {
    key: 'rent_hero_copy',
    label: 'Κείμενο περιγραφής',
    hint: 'Μία–δύο προτάσεις κάτω από τον τίτλο',
    placeholder: DEFAULT_RENT_APP_BRANDING.rent_hero_copy,
    multiline: true,
  },
  {
    key: 'rent_cta_label',
    label: 'Κείμενο κουμπιού',
    hint: 'Π.χ. Βρες όχημα',
    placeholder: DEFAULT_RENT_APP_BRANDING.rent_cta_label,
  },
  {
    key: 'rent_guest_hero_title',
    label: 'Τίτλος (πριν τη σύνδεση)',
    hint: 'Για επισκέπτες που βλέπουν τον στόλο χωρίς login',
    placeholder: DEFAULT_RENT_APP_BRANDING.rent_guest_hero_title,
  },
  {
    key: 'rent_guest_hero_copy',
    label: 'Κείμενο επισκέπτη',
    hint: 'Εμφανίζεται στη δημόσια προεπισκόπηση',
    placeholder: DEFAULT_RENT_APP_BRANDING.rent_guest_hero_copy,
    multiline: true,
  },
];

function formFromAppearance(data) {
  const locs = Array.isArray(data?.rent_pickup_locations)
    ? data.rent_pickup_locations.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  return {
    rent_office_name: data?.rent_office_name || data?.footer_brand_name || data?.display_name || '',
    rent_hero_title: data?.rent_hero_title || DEFAULT_RENT_APP_BRANDING.rent_hero_title,
    rent_hero_copy: data?.rent_hero_copy || DEFAULT_RENT_APP_BRANDING.rent_hero_copy,
    rent_cta_label: data?.rent_cta_label || DEFAULT_RENT_APP_BRANDING.rent_cta_label,
    rent_guest_hero_title:
      data?.rent_guest_hero_title || DEFAULT_RENT_APP_BRANDING.rent_guest_hero_title,
    rent_guest_hero_copy:
      data?.rent_guest_hero_copy || DEFAULT_RENT_APP_BRANDING.rent_guest_hero_copy,
    rent_pickup_locations_text: locs.join('\n'),
  };
}

export default function RentAppBrandingEditor({ embedded = false, onSaved } = {}) {
  const [form, setForm] = useState(() => formFromAppearance(null));
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewGuest, setPreviewGuest] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminSiteAppearance();
      const next = formFromAppearance(data);
      setForm(next);
      setSaved(JSON.stringify(next));
    } catch (err) {
      toast.error(err.message || 'Αποτυχία φόρτωσης εμφάνισης');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = JSON.stringify(form) !== saved;
  const preview = useMemo(
    () => resolveRentAppBranding(form, { guest: previewGuest }),
    [form, previewGuest],
  );

  const onSave = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      const payload = {
        rent_office_name: form.rent_office_name.trim(),
        rent_hero_title: form.rent_hero_title.trim(),
        rent_hero_copy: form.rent_hero_copy.trim(),
        rent_cta_label: form.rent_cta_label.trim(),
        rent_guest_hero_title: form.rent_guest_hero_title.trim(),
        rent_guest_hero_copy: form.rent_guest_hero_copy.trim(),
      };
      // Keep storefront brand in sync when rent office name is set.
      if (payload.rent_office_name) {
        payload.footer_brand_name = payload.rent_office_name;
      }
      const result = await updateSiteAppearance(payload);
      const merged = { ...form, ...(result?.data || payload) };
      const next = formFromAppearance(merged);
      setForm(next);
      setSaved(JSON.stringify(next));
      onSaved?.(result?.data || payload);
      toast.success('Αποθηκεύτηκε — η σελίδα /rent ενημερώθηκε');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rent-brand-editor rent-brand-editor--loading">
        <span className="material-symbols-outlined animate-spin" aria-hidden>
          progress_activity
        </span>
        Φόρτωση εμφάνισης…
      </div>
    );
  }

  return (
    <form onSubmit={onSave} className={`rent-brand-editor space-y-4 ${embedded ? 'rent-brand-editor--embedded' : ''}`}>
      {!embedded ? (
        <header className="rent-brand-hero">
          <div className="rent-brand-hero-copy">
            <p className="rent-brand-kicker">Πρώτα βήματα · εμφάνιση /rent</p>
            <h3 className="rent-brand-title">Το πρόσωπο του γραφείου σας</h3>
            <p className="rent-brand-lead">
              Συμπληρώστε όνομα και κείμενα μία φορά — μετά το Save εμφανίζονται αμέσως στην εφαρμογή
              ενοικίασης. Σε νέο συμβόλαιο Rent γεμίζουν αυτόματα από την επωνυμία του γραφείου.
            </p>
          </div>
          <div className="rent-brand-hero-art" aria-hidden>
            <span className="material-symbols-outlined">car_rental</span>
            <span className="material-symbols-outlined">edit_note</span>
            <span className="material-symbols-outlined">phone_iphone</span>
          </div>
        </header>
      ) : null}

      <div className="rent-brand-grid">
        <div className="rent-brand-fields space-y-3">
          {FIELDS.map((field) => (
            <label key={field.key} className="rent-brand-field">
              <span className="rent-brand-field-label">{field.label}</span>
              <span className="rent-brand-field-hint">{field.hint}</span>
              {field.multiline ? (
                <textarea
                  rows={3}
                  className="rent-brand-input"
                  value={form[field.key]}
                  placeholder={field.placeholder}
                  onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))}
                />
              ) : (
                <input
                  className="rent-brand-input"
                  value={form[field.key]}
                  placeholder={field.placeholder}
                  onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))}
                />
              )}
            </label>
          ))}

          <label className="rent-brand-field">
            <span className="rent-brand-field-label">Σημεία παραλαβής</span>
            <span className="rent-brand-field-hint">
              Διαχειρίζονται από το μενού Ενοικιάσεις → Σημεία παραλαβής (όχι εδώ).
            </span>
            <p className="text-sm text-teal-800 font-semibold mt-1">
              Admin → Ενοικιάσεις → Σημεία παραλαβής
            </p>
          </label>

          <div className="rent-brand-actions">
            <p className="text-sm text-gray-500">
              {dirty ? 'Υπάρχουν αλλαγές προς αποθήκευση.' : 'Όλα αποθηκευμένα.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="/rent"
                target="_blank"
                rel="noreferrer"
                className="rent-brand-secondary-btn"
              >
                Άνοιγμα /rent
              </a>
              <button
                type="submit"
                disabled={saving || !dirty}
                className="rent-brand-primary-btn"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden>
                  save
                </span>
                {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>

        <aside className="rent-brand-preview-col">
          <div className="rent-brand-preview-toolbar">
            <p className="rent-brand-field-label mb-0">Ζωντανή προεπισκόπηση</p>
            <div className="rent-brand-preview-toggle">
              <button
                type="button"
                className={!previewGuest ? 'is-active' : ''}
                onClick={() => setPreviewGuest(false)}
              >
                Συνδεδεμένος
              </button>
              <button
                type="button"
                className={previewGuest ? 'is-active' : ''}
                onClick={() => setPreviewGuest(true)}
              >
                Επισκέπτης
              </button>
            </div>
          </div>
          <div className="rent-brand-phone" aria-hidden={!preview.brandLabel}>
            <div className="rent-brand-phone-notch" />
            <div className="rent-brand-phone-hero">
              <p className="rent-brand-phone-name">{preview.heroKicker || preview.brandLabel}</p>
              <h4 className="rent-brand-phone-title">{preview.title}</h4>
              <p className="rent-brand-phone-copy">{preview.copy}</p>
              <div className="rent-brand-phone-cta">
                <span className="material-symbols-outlined" aria-hidden>
                  search
                </span>
                {preview.ctaLabel}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
