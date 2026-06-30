import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import TemplatePicker from './homepage/TemplatePicker.jsx';
import ThemeGallery from './homepage/ThemeGallery.jsx';
import HomepageLivePreview from './homepage/HomepageLivePreview.jsx';
import {
  FOOTER_TEMPLATES,
  HEADER_TEMPLATES,
  HERO_TEMPLATES,
  TRIP_CARD_TEMPLATES,
  TRIPS_LAYOUT_TEMPLATES,
  getTemplateById,
} from '../../lib/homepage/homepageTemplates.js';
import {
  getHomepageThemeById,
  themeToAppearancePatch,
} from '../../lib/homepage/homepageThemes.js';
import { pushHomepagePreviewDraft } from '../../lib/homepage/homepagePreview.js';
import { fileToTripCoverDataUrl, TRIP_COVER_ACCEPT } from '../../lib/trips/tripImage.js';
import {
  clearSiteAsset,
  DEFAULT_SITE_APPEARANCE,
  fetchAdminSiteAppearance,
  resolveSiteAssetUrl,
  updateSiteAppearance,
  uploadSiteAsset,
} from '../../services/siteAppearanceApi.js';

const SECTIONS = [
  { id: 'overview', label: 'Επισκόπηση', icon: 'dashboard', accent: 'bg-violet-500' },
  { id: 'themes', label: 'Θέματα', icon: 'palette', accent: 'bg-fuchsia-500' },
  { id: 'general', label: 'Γενικά', icon: 'tune', accent: 'bg-slate-600' },
  { id: 'header', label: 'Header', icon: 'web_asset', accent: 'bg-sky-500' },
  { id: 'hero', label: 'Hero', icon: 'panorama', accent: 'bg-indigo-500' },
  { id: 'trips', label: 'Καρτέλες εκδρομών', icon: 'view_carousel', accent: 'bg-emerald-500' },
  { id: 'branding', label: 'Λογότυπο & εικόνες', icon: 'image', accent: 'bg-amber-500' },
  { id: 'footer', label: 'Footer', icon: 'vertical_align_bottom', accent: 'bg-rose-500' },
];

function PanelCard({ title, description, children, action }) {
  return (
    <div className="bg-white rounded-[24px] border border-black/[0.06] shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-black/[0.04] bg-gradient-to-r from-slate-50 to-white flex flex-wrap items-start justify-between gap-4">
        <div>
          <h4 className="font-bold text-gray-900 text-lg">{title}</h4>
          {description && <p className="text-xs text-gray-500 mt-1 max-w-2xl">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function ImageBlock({ title, hint, previewUrl, uploading, onUpload, onClear, hasCustom }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-surface-container-lowest p-5 space-y-4">
      <div>
        <h5 className="font-bold text-gray-900">{title}</h5>
        <p className="text-xs text-gray-500 mt-1">{hint}</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative w-full sm:w-64 h-36 rounded-2xl overflow-hidden bg-gray-100 border border-dashed border-gray-200 shrink-0">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="w-full h-full object-contain bg-slate-900/5" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-1">
              <span className="material-symbols-outlined text-[32px] opacity-40">image</span>
              <span className="text-xs font-medium">Προεπιλογή</span>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
              <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-white text-sm font-bold cursor-pointer hover:opacity-90 w-fit">
            <span className="material-symbols-outlined text-[20px]">upload</span>
            {hasCustom ? 'Αλλαγή' : 'Ανέβασμα'}
            <input type="file" accept={TRIP_COVER_ACCEPT} className="hidden" disabled={uploading} onChange={onUpload} />
          </label>
          {hasCustom && (
            <button
              type="button"
              onClick={onClear}
              disabled={uploading}
              className="text-sm font-bold text-rose-600 hover:text-rose-800 w-fit disabled:opacity-50"
            >
              Επαναφορά προεπιλογής
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SaveButton({ saving, label = 'Αποθήκευση' }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="px-6 py-2.5 rounded-full bg-primary text-white text-sm font-bold disabled:opacity-60 hover:opacity-90 transition-opacity"
    >
      {saving ? 'Αποθήκευση…' : label}
    </button>
  );
}

function OverviewSummary({ form }) {
  const theme = getHomepageThemeById(form.homepage_theme_id);
  const items = [
    { label: 'Θέμα', value: theme.nameEl, highlight: true },
    { label: 'Header', value: getTemplateById(HEADER_TEMPLATES, form.header_template).label },
    { label: 'Hero', value: getTemplateById(HERO_TEMPLATES, form.hero_template).label },
    { label: 'Διάταξη λίστας', value: getTemplateById(TRIPS_LAYOUT_TEMPLATES, form.trips_layout_template).label },
    { label: 'Κάρτα εκδρομής', value: getTemplateById(TRIP_CARD_TEMPLATES, form.trip_card_template).label },
    { label: 'Footer', value: getTemplateById(FOOTER_TEMPLATES, form.footer_template).label },
  ];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-2xl border p-4 ${
            item.highlight
              ? 'border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-violet-50'
              : 'border-black/[0.06] bg-gradient-to-br from-white to-slate-50'
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{item.label}</p>
          <p className="font-bold text-gray-900 mt-1">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export default function HomepageSettingsPanel() {
  const [section, setSection] = useState('overview');
  const [form, setForm] = useState({ ...DEFAULT_SITE_APPEARANCE });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminSiteAppearance();
      setForm({ ...DEFAULT_SITE_APPEARANCE, ...data });
    } catch (err) {
      if (err.message === 'AUTH_EXPIRED') return;
      toast.error('Αποτυχία φόρτωσης ρυθμίσεων αρχικής');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!loading) {
      pushHomepagePreviewDraft(form);
    }
  }, [form, loading]);

  const handleThemePreview = (theme) => {
    const patch = themeToAppearancePatch(theme);
    setForm((p) => ({ ...p, ...patch }));
    toast.success(`Προεπισκόπηση: ${theme.nameEl}`, { id: 'theme-preview' });
  };

  const handleThemeApply = async (theme) => {
    const patch = themeToAppearancePatch(theme);
    setForm((p) => ({ ...p, ...patch }));
    setSaving(true);
    try {
      const result = await updateSiteAppearance(patch);
      setForm((p) => ({ ...p, ...result.data }));
      if (result.offline) {
        toast.success('Το θέμα αποθηκεύτηκε τοπικά', { id: 'theme-apply' });
      } else {
        toast.success(`Εφαρμόστηκε το θέμα «${theme.nameEl}»`, { id: 'theme-apply' });
      }
    } catch (err) {
      if (err.message === 'AUTH_EXPIRED') return;
      toast.error(err.message || 'Αποτυχία εφαρμογής θέματος', { id: 'theme-apply-err' });
    } finally {
      setSaving(false);
    }
  };

  const patchForm = (patch, successMsg) => async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      const result = await updateSiteAppearance(patch);
      setForm((p) => ({ ...p, ...result.data }));
      if (result.offline) {
        toast.success('Αποθηκεύτηκε τοπικά — ο server δεν είναι διαθέσιμος αυτή τη στιγμή', {
          id: 'homepage-save-offline',
        });
      } else {
        toast.success(successMsg, { id: 'homepage-save-ok' });
      }
    } catch (err) {
      if (err.message === 'AUTH_EXPIRED') return;
      const msg = String(err.message || '');
      if (/internal server error/i.test(msg)) {
        toast.error('Σφάλμα server — δοκιμάστε ξανά ή κάντε επανασύνδεση', { id: 'homepage-save-err' });
      } else {
        toast.error(msg || 'Αποτυχία αποθήκευσης', { id: 'homepage-save-err' });
      }
    } finally {
      setSaving(false);
    }
  };

  const saveLayout = patchForm(
    {
      header_template: form.header_template,
      hero_template: form.hero_template,
      trips_layout_template: form.trips_layout_template,
      trip_card_template: form.trip_card_template,
      footer_template: form.footer_template,
    },
    'Τα πρότυπα αποθηκεύτηκαν',
  );

  const saveTripsCopy = patchForm(
    {
      trips_section_eyebrow: form.trips_section_eyebrow,
      trips_section_title: form.trips_section_title,
      trips_section_subtitle: form.trips_section_subtitle,
      intl_section_eyebrow: form.intl_section_eyebrow,
      intl_section_title: form.intl_section_title,
      intl_section_subtitle: form.intl_section_subtitle,
    },
    'Τα κείμενα ενότητας αποθηκεύτηκαν',
  );

  const handleImageUpload = async (kind, e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const setUploading = kind === 'logo' ? setUploadingLogo : setUploadingHero;
    setUploading(true);
    try {
      let toSend = file;
      if (kind === 'hero') {
        const dataUrl = await fileToTripCoverDataUrl(file);
        const blob = await (await fetch(dataUrl)).blob();
        toSend = new File([blob], 'hero.jpg', { type: 'image/jpeg' });
      }
      const result = await uploadSiteAsset(kind, toSend);
      setForm((p) => ({ ...p, ...result.appearance }));
      toast.success(kind === 'logo' ? 'Το λογότυπο ενημερώθηκε' : 'Η φωτογραφία hero ενημερώθηκε');
    } catch (err) {
      if (err.message === 'AUTH_EXPIRED') return;
      toast.error(err.message || 'Αποτυχία ανεβάσματος');
    } finally {
      setUploading(false);
    }
  };

  const handleClearAsset = async (kind) => {
    const setUploading = kind === 'logo' ? setUploadingLogo : setUploadingHero;
    setUploading(true);
    try {
      const result = await clearSiteAsset(kind);
      setForm((p) => ({ ...p, ...result.appearance }));
      toast.success('Επαναφορά προεπιλογής');
    } catch (err) {
      if (err.message === 'AUTH_EXPIRED') return;
      toast.error(err.message || 'Αποτυχία');
    } finally {
      setUploading(false);
    }
  };

  const logoPreview = form.logo_url ? resolveSiteAssetUrl(form.logo_url) : '';
  const heroPreview = resolveSiteAssetUrl(form.hero_image_url);
  const hasCustomLogo = Boolean(form.logo_url);
  const hasCustomHero =
    form.hero_image_url && form.hero_image_url !== DEFAULT_SITE_APPEARANCE.hero_image_url;

  if (loading) {
    return <p className="text-sm text-gray-500 py-4">Φόρτωση ρυθμίσεων αρχικής…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="lg:hidden">
        <HomepageLivePreview form={form} />
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_min(360px,34%)] gap-6 items-start">
        <div className="flex flex-col lg:flex-row gap-6 min-w-0">
      <nav className="lg:w-56 shrink-0">
        <div className="lg:sticky lg:top-4 space-y-2">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-700 text-white p-4 mb-4 shadow-lg shadow-violet-500/20">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Διαμόρφωση</p>
            <p className="font-bold text-lg mt-0.5">Αρχική σελίδα</p>
            <p className="text-xs text-white/75 mt-2">
              20 έτοιμα θέματα ή προσαρμογή κάθε τμήματος — με live preview δεξιά.
            </p>
            <Link
              to="/storefront?preview=1"
              target="_blank"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-2 rounded-full transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              Πλήρης προεπισκόπηση
            </Link>
          </div>

          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                  section === s.id
                    ? 'bg-white text-primary shadow-md ring-1 ring-primary/15'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-white/80'
                }`}
              >
                <span className={`w-8 h-8 rounded-lg ${s.accent} text-white flex items-center justify-center shrink-0`}>
                  <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
                </span>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div className="flex-1 min-w-0 space-y-6">
        {section === 'overview' && (
          <>
            <PanelCard
              title="Τρέχουσα διάταξη"
              description="Σύνοψη των ενεργών προτύπων. Αλλάξτε τα από τα μενού στα αριστερά."
            >
              <OverviewSummary form={form} />
            </PanelCard>
            <PanelCard
              title="Γρήγορη εκκίνηση"
              description="Προτείνουμε: Θέματα → Γενικά → Header → Hero → Καρτέλες → Footer."
            >
              <div className="grid sm:grid-cols-2 gap-3">
                {SECTIONS.filter((s) => s.id !== 'overview').map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSection(s.id)}
                    className="flex items-center gap-3 p-4 rounded-2xl border border-black/[0.06] hover:border-primary/30 hover:shadow-md text-left transition-all bg-white group"
                  >
                    <span className={`w-10 h-10 rounded-xl ${s.accent} text-white flex items-center justify-center group-hover:scale-105 transition-transform`}>
                      <span className="material-symbols-outlined">{s.icon}</span>
                    </span>
                    <span className="font-bold text-gray-900">{s.label}</span>
                  </button>
                ))}
              </div>
            </PanelCard>
          </>
        )}

        {section === 'themes' && (
          <PanelCard
            title="Θέματα αρχικής σελίδας"
            description="20 πλήρη σχέδια — header, hero, κάρτες, χρώματα & footer σε ένα κλικ. Η προεπισκόπηση ενημερώνεται αυτόματα."
          >
            <ThemeGallery
              activeThemeId={form.homepage_theme_id || 'aegean_classic'}
              onPreview={handleThemePreview}
              onApply={handleThemeApply}
              applying={saving}
            />
          </PanelCard>
        )}

        {section === 'general' && (
          <form
            onSubmit={patchForm(
              {
                homepage_theme_id: form.homepage_theme_id,
                accent_color: form.accent_color,
                secondary_color: form.secondary_color,
                surface_color: form.surface_color,
                show_fleet_section: form.show_fleet_section,
                show_why_us_section: form.show_why_us_section,
              },
              'Οι γενικές ρυθμίσεις αποθηκεύτηκαν',
            )}
          >
            <PanelCard
              title="Γενικές ρυθμίσεις"
              description="Χρώματα brand, εμφάνιση ενότητων και ενεργό θέμα."
              action={<SaveButton saving={saving} label="Αποθήκευση" />}
            >
              <div className="space-y-8">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Ενεργό θέμα</p>
                  <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-black/[0.06]">
                    <span
                      className="w-10 h-10 rounded-xl shrink-0"
                      style={{ background: form.accent_color || '#0ea5e9' }}
                    />
                    <div>
                      <p className="font-bold text-gray-900">{getHomepageThemeById(form.homepage_theme_id).nameEl}</p>
                      <button
                        type="button"
                        onClick={() => setSection('themes')}
                        className="text-xs font-bold text-primary hover:underline mt-0.5"
                      >
                        Αλλαγή θέματος →
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Χρώματα</p>
                  <div className="grid sm:grid-cols-3 gap-4">
                    {[
                      { key: 'accent_color', label: 'Κύριο (accent)' },
                      { key: 'secondary_color', label: 'Δευτερεύον' },
                      { key: 'surface_color', label: 'Φόντο σελίδας' },
                    ].map(({ key, label }) => (
                      <label key={key} className="block">
                        <span className="text-sm font-bold text-gray-700">{label}</span>
                        <div className="mt-2 flex items-center gap-3">
                          <input
                            type="color"
                            value={form[key] || '#0ea5e9'}
                            onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                            className="w-12 h-12 rounded-xl border border-black/10 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={form[key] || ''}
                            onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                            className="flex-1 rounded-xl border px-3 py-2 text-sm font-mono"
                          />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Ενότητες σελίδας</p>
                  <div className="space-y-3">
                    {[
                      { key: 'show_fleet_section', label: 'Εμφάνιση στόλου', hint: 'Premium λεωφορεία & παροχές' },
                      { key: 'show_why_us_section', label: 'Εμφάνιση «Γιατί να μας επιλέξετε»', hint: 'Τα 3 πλεονεκτήματα κάτω από τις εκδρομές' },
                    ].map(({ key, label, hint }) => (
                      <label
                        key={key}
                        className="flex items-start gap-3 p-4 rounded-2xl border border-black/[0.06] bg-white cursor-pointer hover:border-primary/20 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={form[key] !== false}
                          onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.checked }))}
                          className="mt-1 w-4 h-4 rounded border-gray-300 text-primary"
                        />
                        <div>
                          <span className="font-bold text-gray-900 text-sm">{label}</span>
                          <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </PanelCard>
          </form>
        )}

        {section === 'header' && (
          <form onSubmit={saveLayout}>
            <PanelCard
              title="Πρότυπα Header"
              description="Η εμφάνιση της κορυφής της αρχικής — λογότυπο, πλοήγηση, στυλ."
              action={<SaveButton saving={saving} label="Αποθήκευση header" />}
            >
              <TemplatePicker
                category="header"
                templates={HEADER_TEMPLATES}
                value={form.header_template}
                onChange={(id) => setForm((p) => ({ ...p, header_template: id }))}
              />
            </PanelCard>
          </form>
        )}

        {section === 'hero' && (
          <form
            onSubmit={patchForm(
              {
                hero_template: form.hero_template,
                hero_badge: form.hero_badge,
                hero_title: form.hero_title,
                hero_title_accent: form.hero_title_accent,
                hero_subtitle: form.hero_subtitle,
                hero_search_label: form.hero_search_label,
              },
              'Το hero αποθηκεύτηκε',
            )}
          >
            <PanelCard
              title="Πρότυπα Hero"
              description="Η πρώτη εντύπωση — φωτογραφία, τίτλος και φόρμα αναζήτησης εκδρομών."
              action={<SaveButton saving={saving} label="Αποθήκευση hero" />}
            >
              <TemplatePicker
                category="hero"
                templates={HERO_TEMPLATES}
                value={form.hero_template}
                onChange={(id) => setForm((p) => ({ ...p, hero_template: id }))}
              />

              <div className="mt-8 pt-8 border-t border-black/[0.06] space-y-4">
                <h5 className="font-bold text-gray-900">Κείμενα hero</h5>
                <label className="block text-sm">
                  <span className="font-bold text-gray-700">Badge</span>
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    value={form.hero_badge}
                    onChange={(e) => setForm((p) => ({ ...p, hero_badge: e.target.value }))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-bold text-gray-700">Τίτλος</span>
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    value={form.hero_title}
                    onChange={(e) => setForm((p) => ({ ...p, hero_title: e.target.value }))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-bold text-gray-700">Τίτλος — τονισμένο</span>
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    value={form.hero_title_accent}
                    onChange={(e) => setForm((p) => ({ ...p, hero_title_accent: e.target.value }))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-bold text-gray-700">Υπότιτλος</span>
                  <textarea
                    rows={3}
                    className="mt-1 w-full rounded-xl border px-3 py-2 resize-y"
                    value={form.hero_subtitle}
                    onChange={(e) => setForm((p) => ({ ...p, hero_subtitle: e.target.value }))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-bold text-gray-700">Ετικέτα φόρμας</span>
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    value={form.hero_search_label}
                    onChange={(e) => setForm((p) => ({ ...p, hero_search_label: e.target.value }))}
                  />
                </label>
              </div>
            </PanelCard>
          </form>
        )}

        {section === 'trips' && (
          <>
            <form onSubmit={saveLayout}>
              <PanelCard
                title="Διάταξη λίστας εκδρομών"
                description="Πώς εμφανίζονται οι εκδρομές στη μέση της σελίδας — grid, carousel, λίστα κ.λπ."
                action={<SaveButton saving={saving} label="Αποθήκευση διάταξης" />}
              >
                <TemplatePicker
                  category="trips_layout"
                  templates={TRIPS_LAYOUT_TEMPLATES}
                  value={form.trips_layout_template}
                  onChange={(id) => setForm((p) => ({ ...p, trips_layout_template: id }))}
                />
              </PanelCard>
            </form>

            <form onSubmit={saveLayout} className="mt-6">
              <PanelCard
                title="Στυλ κάρτας εκδρομής"
                description="Η εμφάνιση κάθε μεμονωμένης κάρτας — premium, minimal, overlay, magazine κ.λπ."
                action={<SaveButton saving={saving} label="Αποθήκευση καρτών" />}
              >
                <TemplatePicker
                  category="trip_card"
                  templates={TRIP_CARD_TEMPLATES}
                  value={form.trip_card_template}
                  onChange={(id) => setForm((p) => ({ ...p, trip_card_template: id }))}
                  columns={4}
                />
              </PanelCard>
            </form>

            <form onSubmit={saveTripsCopy} className="mt-6">
              <PanelCard
                title="Κείμενα ενότητας εκδρομών"
                description="Τίτλοι πάνω από τις λίστες εγχώριων και διεθνών εκδρομών."
                action={<SaveButton saving={saving} label="Αποθήκευση κειμένων" />}
              >
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">Ελλάδα</p>
                    <input
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      placeholder="Eyebrow"
                      value={form.trips_section_eyebrow}
                      onChange={(e) => setForm((p) => ({ ...p, trips_section_eyebrow: e.target.value }))}
                    />
                    <input
                      className="w-full rounded-xl border px-3 py-2 text-sm font-bold"
                      placeholder="Τίτλος"
                      value={form.trips_section_title}
                      onChange={(e) => setForm((p) => ({ ...p, trips_section_title: e.target.value }))}
                    />
                    <textarea
                      rows={2}
                      className="w-full rounded-xl border px-3 py-2 text-sm resize-y"
                      placeholder="Υπότιτλος"
                      value={form.trips_section_subtitle}
                      onChange={(e) => setForm((p) => ({ ...p, trips_section_subtitle: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-violet-600">Εξωτερικό</p>
                    <input
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      value={form.intl_section_eyebrow}
                      onChange={(e) => setForm((p) => ({ ...p, intl_section_eyebrow: e.target.value }))}
                    />
                    <input
                      className="w-full rounded-xl border px-3 py-2 text-sm font-bold"
                      value={form.intl_section_title}
                      onChange={(e) => setForm((p) => ({ ...p, intl_section_title: e.target.value }))}
                    />
                    <textarea
                      rows={2}
                      className="w-full rounded-xl border px-3 py-2 text-sm resize-y"
                      value={form.intl_section_subtitle}
                      onChange={(e) => setForm((p) => ({ ...p, intl_section_subtitle: e.target.value }))}
                    />
                  </div>
                </div>
              </PanelCard>
            </form>
          </>
        )}

        {section === 'branding' && (
          <PanelCard
            title="Λογότυπο & εικόνες"
            description="Το λογότυπο στο header και η hero φωτογραφία."
          >
            <div className="space-y-6">
              <ImageBlock
                title="Λογότυπο"
                hint="PNG ή JPG. Εμφανίζεται στο header του storefront."
                previewUrl={logoPreview}
                uploading={uploadingLogo}
                hasCustom={hasCustomLogo}
                onUpload={(e) => handleImageUpload('logo', e)}
                onClear={() => handleClearAsset('logo')}
              />
              <ImageBlock
                title="Hero φωτογραφία"
                hint="Φόντο πίσω από τον τίτλο. Συμπιέζεται αυτόματα (JPG)."
                previewUrl={heroPreview}
                uploading={uploadingHero}
                hasCustom={hasCustomHero}
                onUpload={(e) => handleImageUpload('hero', e)}
                onClear={() => handleClearAsset('hero')}
              />
            </div>
          </PanelCard>
        )}

        {section === 'footer' && (
          <form
            onSubmit={patchForm(
              {
                footer_template: form.footer_template,
                footer_brand_name: form.footer_brand_name,
                footer_copyright: form.footer_copyright,
                footer_privacy_label: form.footer_privacy_label,
                footer_privacy_url: form.footer_privacy_url,
                footer_terms_label: form.footer_terms_label,
                footer_terms_url: form.footer_terms_url,
                footer_contact_email: form.footer_contact_email,
                footer_contact_phone: form.footer_contact_phone,
                footer_address: form.footer_address,
              },
              'Το footer αποθηκεύτηκε',
            )}
          >
            <PanelCard
              title="Πρότυπα Footer"
              description="Το κάτω μέρος της αρχικής — στήλες, dark band, newsletter κ.λπ."
              action={<SaveButton saving={saving} label="Αποθήκευση footer" />}
            >
              <TemplatePicker
                category="footer"
                templates={FOOTER_TEMPLATES}
                value={form.footer_template}
                onChange={(id) => setForm((p) => ({ ...p, footer_template: id }))}
              />

              <div className="mt-8 pt-8 border-t border-black/[0.06] grid md:grid-cols-2 gap-4">
                <label className="block text-sm md:col-span-2">
                  <span className="font-bold text-gray-700">Επωνυμία</span>
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    value={form.footer_brand_name}
                    onChange={(e) => setForm((p) => ({ ...p, footer_brand_name: e.target.value }))}
                  />
                </label>
                <label className="block text-sm md:col-span-2">
                  <span className="font-bold text-gray-700">Copyright</span>
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    value={form.footer_copyright}
                    onChange={(e) => setForm((p) => ({ ...p, footer_copyright: e.target.value }))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-bold text-gray-700">Privacy — κείμενο</span>
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    value={form.footer_privacy_label}
                    onChange={(e) => setForm((p) => ({ ...p, footer_privacy_label: e.target.value }))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-bold text-gray-700">Privacy — URL</span>
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    value={form.footer_privacy_url}
                    onChange={(e) => setForm((p) => ({ ...p, footer_privacy_url: e.target.value }))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-bold text-gray-700">Όροι — κείμενο</span>
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    value={form.footer_terms_label}
                    onChange={(e) => setForm((p) => ({ ...p, footer_terms_label: e.target.value }))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-bold text-gray-700">Όροι — URL</span>
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    value={form.footer_terms_url}
                    onChange={(e) => setForm((p) => ({ ...p, footer_terms_url: e.target.value }))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-bold text-gray-700">Email</span>
                  <input
                    type="email"
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    value={form.footer_contact_email}
                    onChange={(e) => setForm((p) => ({ ...p, footer_contact_email: e.target.value }))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-bold text-gray-700">Τηλέφωνο</span>
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    value={form.footer_contact_phone}
                    onChange={(e) => setForm((p) => ({ ...p, footer_contact_phone: e.target.value }))}
                  />
                </label>
                <label className="block text-sm md:col-span-2">
                  <span className="font-bold text-gray-700">Διεύθυνση</span>
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    value={form.footer_address}
                    onChange={(e) => setForm((p) => ({ ...p, footer_address: e.target.value }))}
                  />
                </label>
              </div>
            </PanelCard>
          </form>
        )}
      </div>
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-4">
            <HomepageLivePreview form={form} />
          </div>
        </aside>
      </div>
    </div>
  );
}
