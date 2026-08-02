import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import TemplatePicker from './homepage/TemplatePicker.jsx';
import ThemeGallery from './homepage/ThemeGallery.jsx';
import BrandColorEditor from './homepage/BrandColorEditor.jsx';
import RentAppBrandingEditor from './fleet/RentAppBrandingEditor.jsx';
import PageSliderEditor from './homepage/PageSliderEditor.jsx';
import HeroImageBlock from './homepage/HeroImageBlock.jsx';
import {
  FOOTER_TEMPLATES,
  HEADER_TEMPLATES,
  HERO_TEMPLATES,
  RENT_FLEET_CARD_TEMPLATES,
  RENT_FLEET_LAYOUT_TEMPLATES,
  TRIP_CARD_TEMPLATES,
  TRIPS_LAYOUT_TEMPLATES,
  getTemplateById,
} from '../../lib/homepage/homepageTemplates.js';
import {
  getHomepageThemeById,
  themeToAppearancePatch,
} from '../../lib/homepage/homepageThemes.js';
import { pushHomepagePreviewDraft } from '../../lib/homepage/homepagePreview.js';
import { pageSliderPatch } from '../../lib/homepage/pageSlider.js';
import { fileToTripCoverDataUrl, TRIP_COVER_ACCEPT } from '../../lib/trips/tripImage.js';
import {
  clearSiteAsset,
  DEFAULT_SITE_APPEARANCE,
  fetchAdminSiteAppearance,
  resolveSiteAssetUrl,
  updateSiteAppearance,
  uploadSiteAsset,
} from '../../services/siteAppearanceApi.js';
import {
  clampLogoHeight,
  clampLogoMaxWidth,
  officeLogoImageStyle,
} from '../../lib/branding/officeBrand.js';
import {
  resolveRentAppBranding,
} from '../../lib/rental/rentAppBranding.js';
import {
  DEFAULT_OFFICE_MODULES,
  contractDesignLabel,
  fetchAdminOfficeModules,
  officeModeFromModules,
  resolveDesignPageForModules,
} from '../../services/officeModulesApi.js';
import { isPlatformMarketingHost } from '../../lib/platform/tenantHost.js';

const DESIGN_PAGES = [
  {
    id: 'home',
    label: 'Λεωφορεία',
    title: 'Αρχική · εκδρομές',
    blurb: 'Θέματα, hero, slider και κάρτες εκδρομών της αρχικής σελίδας.',
    // Storefront shell only on office domains — never on www.poreiago.com.
    previewTo: '/storefront?preview=1',
    previewLabel: 'Προεπισκόπηση σε νέο tab',
    platformPreviewTo: '/',
    platformPreviewLabel: 'Αρχική PoreiaGo (χωρίς storefront γραφείου)',
    icon: 'directions_bus',
    accentFrom: 'from-sky-700',
    accentVia: 'via-indigo-700',
    accentTo: 'to-slate-800',
  },
  {
    id: 'rent',
    label: 'Ενοικιάσεις',
    title: 'Σελίδα /rent',
    blurb: 'Όνομα γραφείου, κείμενα και hero slider για την εφαρμογή ενοικίασης.',
    previewTo: '/rent',
    previewLabel: 'Άνοιγμα /rent',
    icon: 'car_rental',
    accentFrom: 'from-teal-700',
    accentVia: 'via-cyan-700',
    accentTo: 'to-sky-900',
  },
];

const HOME_SECTIONS = [
  { id: 'overview', label: 'Επισκόπηση', icon: 'dashboard', accent: 'bg-violet-500' },
  { id: 'themes', label: 'Θέματα', icon: 'palette', accent: 'bg-fuchsia-500' },
  { id: 'general', label: 'Γενικά', icon: 'tune', accent: 'bg-slate-600' },
  { id: 'header', label: 'Header', icon: 'web_asset', accent: 'bg-sky-500' },
  { id: 'hero', label: 'Hero', icon: 'panorama', accent: 'bg-indigo-500' },
  { id: 'slider', label: 'Slider', icon: 'slideshow', accent: 'bg-cyan-600' },
  { id: 'trips', label: 'Καρτέλες εκδρομών', icon: 'view_carousel', accent: 'bg-emerald-500' },
  { id: 'branding', label: 'Λογότυπο & εικόνες', icon: 'image', accent: 'bg-amber-500' },
  { id: 'footer', label: 'Footer', icon: 'vertical_align_bottom', accent: 'bg-rose-500' },
];

const RENT_SECTIONS = [
  { id: 'overview', label: 'Επισκόπηση', icon: 'dashboard', accent: 'bg-teal-600' },
  { id: 'copy', label: 'Όνομα & κείμενα', icon: 'edit_note', accent: 'bg-cyan-600' },
  { id: 'fleet', label: 'Καρτέλες στόλου', icon: 'directions_car', accent: 'bg-sky-600' },
  { id: 'slider', label: 'Slider', icon: 'slideshow', accent: 'bg-emerald-600' },
];

function sanitizeDesignPage(value) {
  return value === 'rent' ? 'rent' : 'home';
}

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

function LogoBlock({
  form,
  setForm,
  previewUrl,
  uploading,
  hasCustom,
  onUpload,
  onClear,
  onApplyUrl,
}) {
  const [previewTone, setPreviewTone] = useState('light');
  const [dragOver, setDragOver] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const height = clampLogoHeight(form.logo_height_px);
  const maxWidth = clampLogoMaxWidth(form.logo_max_width_px);
  const logoStyle = officeLogoImageStyle(form);
  const brandName = (form.footer_brand_name || '').trim();
  const showName = form.logo_show_name !== false;

  const onDropFile = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    onUpload({ target: { files: [file], value: '' } });
  };

  const copyUrl = () => {
    if (!previewUrl) return;
    navigator.clipboard?.writeText(previewUrl).then(
      () => toast.success('Το URL αντιγράφηκε'),
      () => toast.error('Αποτυχία αντιγραφής'),
    );
  };

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-black/[0.04] bg-slate-50/80">
        <h5 className="font-bold text-slate-900">Λογότυπο</h5>
        <p className="text-xs text-slate-500 mt-0.5">
          PNG, JPG ή WebP · εμφανίζεται στο header και footer
        </p>
      </div>

      <div className="p-5 grid lg:grid-cols-[240px_1fr] gap-6">
        {/* Preview */}
        <div className="space-y-2.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Προεπισκόπηση
            </span>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-bold">
              {['light', 'dark'].map((tone) => (
                <button
                  key={tone}
                  type="button"
                  onClick={() => setPreviewTone(tone)}
                  className={`px-2.5 py-1 rounded-md capitalize transition-colors ${
                    previewTone === tone ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {tone}
                </button>
              ))}
            </div>
          </div>

          <div
            className={`relative h-44 rounded-xl overflow-hidden border flex items-center justify-center px-4 transition ${
              dragOver ? 'border-sky-400 bg-sky-50' : 'border-slate-200'
            } ${previewTone === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDropFile}
          >
            {previewUrl ? (
              <span className="inline-flex items-center gap-2.5 max-w-full">
                <img src={previewUrl} alt="" style={logoStyle} className="object-contain drop-shadow-sm" />
                {showName && brandName ? (
                  <span
                    className={`font-bold text-sm truncate ${
                      previewTone === 'dark' ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {brandName}
                  </span>
                ) : null}
              </span>
            ) : (
              <div
                className={`flex flex-col items-center gap-1 ${
                  previewTone === 'dark' ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                <span className="material-symbols-outlined text-[28px] opacity-50">add_photo_alternate</span>
                <span className="text-xs font-medium">Σύρετε ή ανεβάστε</span>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
                <span className="material-symbols-outlined animate-spin text-sky-600">progress_activity</span>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold cursor-pointer hover:bg-slate-800">
              <span className="material-symbols-outlined text-[18px]">upload</span>
              {hasCustom ? 'Αλλαγή' : 'Ανέβασμα'}
              <input
                type="file"
                accept={TRIP_COVER_ACCEPT}
                className="hidden"
                disabled={uploading}
                onChange={onUpload}
              />
            </label>
            {hasCustom && (
              <>
                <button
                  type="button"
                  onClick={copyUrl}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  Αντιγραφή
                </button>
                <button
                  type="button"
                  onClick={onClear}
                  disabled={uploading}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  Αφαίρεση
                </button>
              </>
            )}
          </div>

          {/* Size */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Μέγεθος</p>

            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-sm font-semibold text-slate-800">Ύψος</span>
                <span className="tabular-nums text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-md px-2 py-0.5">
                  {height}px
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={96}
                step={2}
                value={height}
                onChange={(e) => setForm((p) => ({ ...p, logo_height_px: Number(e.target.value) }))}
                className="w-full h-1.5 rounded-full appearance-none bg-slate-200 accent-slate-900 cursor-pointer"
              />
              <div className="flex justify-between mt-1 text-[10px] font-medium text-slate-400">
                <span>20</span>
                <span>96</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">Μέγ. πλάτος</span>
                <span className="tabular-nums text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-md px-2 py-0.5">
                  {maxWidth}px
                </span>
              </div>
              <input
                type="range"
                min={60}
                max={400}
                step={10}
                value={maxWidth}
                onChange={(e) => setForm((p) => ({ ...p, logo_max_width_px: Number(e.target.value) }))}
                className="w-full h-1.5 rounded-full appearance-none bg-slate-200 accent-slate-900 cursor-pointer"
              />
              <div className="flex justify-between mt-1 text-[10px] font-medium text-slate-400">
                <span>60</span>
                <span>400</span>
              </div>
            </div>
          </div>

          {/* Name toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={showName}
            onClick={() => setForm((p) => ({ ...p, logo_show_name: !(p.logo_show_name !== false) }))}
            className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
              showName ? 'border-slate-900/15 bg-slate-900/[0.03]' : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">Όνομα δίπλα στο logo</p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {brandName || 'Ορίστε επωνυμία στο Footer'}
              </p>
            </div>
            <span
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                showName ? 'bg-slate-900' : 'bg-slate-300'
              }`}
              aria-hidden
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  showName ? 'translate-x-5' : ''
                }`}
              />
            </span>
          </button>

          {/* URL */}
          <div className="rounded-xl border border-slate-200 p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-600">Επικόλληση URL εικόνας</p>
            <div className="flex gap-2">
              <input
                type="url"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="https://…/logo.png"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
              />
              <button
                type="button"
                disabled={!urlDraft.trim()}
                onClick={() => {
                  onApplyUrl?.(urlDraft.trim());
                  setUrlDraft('');
                }}
                className="shrink-0 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-40"
              >
                ΟΚ
              </button>
            </div>
          </div>
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

const HERO_TEXT_DEFAULTS = {
  hero_badge: DEFAULT_SITE_APPEARANCE.hero_badge,
  hero_title: DEFAULT_SITE_APPEARANCE.hero_title,
  hero_title_accent: DEFAULT_SITE_APPEARANCE.hero_title_accent,
  hero_subtitle: DEFAULT_SITE_APPEARANCE.hero_subtitle,
  hero_search_label: DEFAULT_SITE_APPEARANCE.hero_search_label,
};

function HeroTextField({
  label,
  hint,
  icon,
  value,
  onChange,
  onReset,
  placeholder,
  multiline = false,
  rows = 3,
  maxHint,
}) {
  const len = String(value || '').length;
  const softMax = maxHint || 0;
  const overSoft = softMax > 0 && len > softMax;

  return (
    <label className="block rounded-2xl border border-black/[0.06] bg-slate-50/60 hover:bg-slate-50 focus-within:bg-white focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-100 transition-all p-3.5 md:p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-white border border-black/[0.06] flex items-center justify-center shrink-0 text-slate-500">
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
          </span>
          <div className="min-w-0">
            <span className="block text-sm font-bold text-slate-800">{label}</span>
            {hint ? <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">{hint}</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {softMax > 0 ? (
            <span
              className={`text-[10px] font-bold tabular-nums ${
                overSoft ? 'text-amber-600' : 'text-slate-400'
              }`}
            >
              {len}/{softMax}
            </span>
          ) : (
            <span className="text-[10px] font-bold tabular-nums text-slate-400">{len}</span>
          )}
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="text-[10px] font-bold uppercase tracking-wide text-sky-700 hover:text-sky-900 px-1.5 py-0.5 rounded-md hover:bg-sky-50"
              title="Επαναφορά προεπιλογής"
            >
              Προεπιλογή
            </button>
          ) : null}
        </div>
      </div>
      {multiline ? (
        <textarea
          rows={rows}
          className="w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 resize-y focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300"
          value={value}
          placeholder={placeholder}
          onChange={onChange}
        />
      ) : (
        <input
          className="w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300"
          value={value}
          placeholder={placeholder}
          onChange={onChange}
        />
      )}
    </label>
  );
}

function HeroTextsBlock({ form, setForm }) {
  const setField = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));
  const resetField = (key) => () =>
    setForm((p) => ({ ...p, [key]: HERO_TEXT_DEFAULTS[key] ?? '' }));
  const resetAll = () => {
    setForm((p) => ({ ...p, ...HERO_TEXT_DEFAULTS }));
    toast.success('Επαναφορά προεπιλεγμένων κειμένων hero');
  };

  const badge = String(form.hero_badge || '').trim();
  const title = String(form.hero_title || '').trim();
  const accent = String(form.hero_title_accent || '').trim();
  const subtitle = String(form.hero_subtitle || '').trim();
  const searchLabel = String(form.hero_search_label || '').trim();

  return (
    <div className="mt-8 pt-8 border-t border-black/[0.06]">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h5 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <span className="material-symbols-outlined text-sky-600 text-[22px]">title</span>
            Κείμενα hero
          </h5>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Εμφανίζονται πάνω στη φωτογραφία της αρχικής. Η προεπισκόπηση δεξιά ενημερώνεται καθώς
            πληκτρολογείτε.
          </p>
        </div>
        <button
          type="button"
          onClick={resetAll}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-full border border-black/[0.08] bg-white hover:bg-slate-50"
        >
          <span className="material-symbols-outlined text-[16px]">restart_alt</span>
          Όλα στα προεπιλεγμένα
        </button>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)] gap-5 lg:gap-6 items-start">
        <div className="space-y-3">
          <HeroTextField
            label="Badge"
            hint="Μικρή ετικέτα πάνω από τον τίτλο"
            icon="sell"
            value={form.hero_badge}
            onChange={setField('hero_badge')}
            onReset={resetField('hero_badge')}
            placeholder="π.χ. Premium Ταξιδιωτική Εμπειρία"
            maxHint={42}
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <HeroTextField
              label="Τίτλος"
              hint="Κύρια γραμμή τίτλου"
              icon="format_size"
              value={form.hero_title}
              onChange={setField('hero_title')}
              onReset={resetField('hero_title')}
              placeholder="π.χ. Η Ελλάδα, όπως δεν την έχεις ξαναδεί:"
              maxHint={72}
            />
            <HeroTextField
              label="Τίτλος — τονισμένο"
              hint="Δεύτερη γραμμή με έμφαση (χρώμα)"
              icon="format_color_text"
              value={form.hero_title_accent}
              onChange={setField('hero_title_accent')}
              onReset={resetField('hero_title_accent')}
              placeholder="π.χ. Άνεση, ασφάλεια & θέση εξασφαλισμένη."
              maxHint={72}
            />
          </div>
          <HeroTextField
            label="Υπότιτλος"
            hint="Σύντομη περιγραφή κάτω από τον τίτλο"
            icon="notes"
            value={form.hero_subtitle}
            onChange={setField('hero_subtitle')}
            onReset={resetField('hero_subtitle')}
            placeholder="Περιγράψτε τι βρίσκει ο επισκέπτης…"
            multiline
            rows={3}
            maxHint={180}
          />
          <HeroTextField
            label="Ετικέτα φόρμας"
            hint="Επικεφαλίδα πάνω από τη φόρμα / πρόγραμμα εκδρομών"
            icon="search"
            value={form.hero_search_label}
            onChange={setField('hero_search_label')}
            onReset={resetField('hero_search_label')}
            placeholder="π.χ. Πρόγραμμα εκδρομών"
            maxHint={36}
          />
        </div>

        <aside className="lg:sticky lg:top-4">
          <div className="rounded-[22px] overflow-hidden border border-black/[0.08] shadow-[0_12px_32px_rgba(15,23,42,0.1)] bg-slate-900">
            <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between gap-2 bg-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                Ζωντανή προεπισκόπηση
              </span>
              <span className="text-[10px] font-medium text-sky-300/90">Hero · αρχική</span>
            </div>
            <div
              className="relative min-h-[280px] p-5 md:p-6 flex flex-col justify-end"
              style={{
                background:
                  'linear-gradient(160deg, rgba(15,23,42,0.35) 0%, rgba(15,23,42,0.78) 55%, rgba(15,23,42,0.92) 100%), radial-gradient(ellipse 70% 50% at 20% 20%, rgba(56,189,248,0.22), transparent)',
              }}
            >
              {badge ? (
                <span className="inline-flex self-start mb-3 px-2.5 py-1 rounded-full bg-white/15 border border-white/20 text-[10px] font-bold uppercase tracking-wide text-white/90">
                  {badge}
                </span>
              ) : (
                <span className="inline-flex self-start mb-3 px-2.5 py-1 rounded-full border border-dashed border-white/25 text-[10px] text-white/40">
                  Badge
                </span>
              )}
              <h3 className="text-xl md:text-2xl font-semibold text-white tracking-tight leading-snug">
                {title || <span className="text-white/35">Τίτλος hero…</span>}
                {accent ? (
                  <span className="block text-sky-300 mt-1.5">{accent}</span>
                ) : (
                  <span className="block text-sky-300/35 mt-1.5 text-lg">Τονισμένο κείμενο…</span>
                )}
              </h3>
              <p className="text-[13px] text-white/70 mt-3 leading-relaxed line-clamp-4">
                {subtitle || 'Ο υπότιτλος εμφανίζεται εδώ.'}
              </p>
              <div className="mt-5 rounded-2xl bg-white/95 p-3.5 border border-white/40 shadow-lg">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  {searchLabel || 'Ετικέτα φόρμας'}
                </p>
                <div className="h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center px-3 text-xs text-slate-400">
                  Προεπισκόπηση πεδίων αναζήτησης
                </div>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2.5 leading-relaxed px-0.5">
            Η τελική εμφάνιση εξαρτάται και από το πρότυπο Hero / τη φωτογραφία στην ενότητα
            «Λογότυπο & εικόνες».
          </p>
        </aside>
      </div>
    </div>
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
    {
      label: 'Κάρτα εξωτερικού',
      value: getTemplateById(
        TRIP_CARD_TEMPLATES,
        form.intl_trip_card_template || 'abroad_horizontal',
      ).label,
    },
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

export default function HomepageSettingsPanel({ initialDesignPage } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const pageFromQuery = searchParams.get('page') || searchParams.get('designPage');
  const [modules, setModules] = useState(DEFAULT_OFFICE_MODULES);
  const [modulesReady, setModulesReady] = useState(false);
  const officeMode = officeModeFromModules(modules);
  const [designPage, setDesignPage] = useState(() =>
    sanitizeDesignPage(initialDesignPage || pageFromQuery),
  );
  const [section, setSection] = useState('overview');
  const [form, setForm] = useState({ ...DEFAULT_SITE_APPEARANCE });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAdminOfficeModules().then((mods) => {
      if (cancelled) return;
      setModules(mods);
      setModulesReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!modulesReady) return;
    const requested = initialDesignPage || pageFromQuery;
    const next = resolveDesignPageForModules(requested, modules);
    setDesignPage((prev) => (prev === next ? prev : next));
    const cur = pageFromQuery === 'rent' ? 'rent' : pageFromQuery === 'home' ? 'home' : '';
    if (requested && resolveDesignPageForModules(requested, modules) !== sanitizeDesignPage(requested)) {
      const params = new URLSearchParams(window.location.search);
      if (next === 'rent') params.set('page', 'rent');
      else params.delete('page');
      params.delete('designPage');
      setSearchParams(params, { replace: true });
    } else if (!cur && next === 'rent' && officeMode === 'rent_only') {
      const params = new URLSearchParams(window.location.search);
      params.set('page', 'rent');
      setSearchParams(params, { replace: true });
    }
  }, [modulesReady, modules, initialDesignPage, pageFromQuery, officeMode, setSearchParams]);

  const selectDesignPage = (id) => {
    const next = resolveDesignPageForModules(id, modules);
    setDesignPage(next);
    setSection('overview');
    const params = new URLSearchParams(searchParams);
    if (next === 'rent') params.set('page', 'rent');
    else params.delete('page');
    params.delete('designPage');
    setSearchParams(params, { replace: true });
  };

  const availablePages = DESIGN_PAGES.filter((p) => {
    if (officeMode === 'rent_only') return p.id === 'rent';
    if (officeMode === 'trips_only') return p.id === 'home';
    return true;
  });
  const canSwitchPages = availablePages.length > 1;
  const navSections = designPage === 'rent' ? RENT_SECTIONS : HOME_SECTIONS;
  const activePageMeta = DESIGN_PAGES.find((p) => p.id === designPage) || availablePages[0] || DESIGN_PAGES[0];
  const onPlatformHost = isPlatformMarketingHost();
  const previewTo =
    onPlatformHost && activePageMeta.platformPreviewTo
      ? activePageMeta.platformPreviewTo
      : activePageMeta.previewTo;
  const previewLabel =
    onPlatformHost && activePageMeta.platformPreviewLabel
      ? activePageMeta.platformPreviewLabel
      : activePageMeta.previewLabel;
  const rentPreview = resolveRentAppBranding(form, { guest: false });
  const contractBadge = contractDesignLabel(officeMode);

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
      rent_fleet_layout_template: form.rent_fleet_layout_template,
      rent_fleet_card_template: form.rent_fleet_card_template,
      intl_trips_layout_template: form.intl_trips_layout_template || 'horizontal_scroll',
      intl_trip_card_template: form.intl_trip_card_template || 'abroad_horizontal',
    },
    'Τα πρότυπα αποθηκεύτηκαν',
  );

  const saveRentFleetLayout = patchForm(
    {
      rent_fleet_layout_template: form.rent_fleet_layout_template || 'rent_grid_three',
      rent_fleet_card_template: form.rent_fleet_card_template || 'rent_premium',
    },
    'Τα πρότυπα στόλου ενοικίασης αποθηκεύτηκαν',
  );

  const saveTripsCopy = patchForm(
    {
      trips_section_eyebrow: form.trips_section_eyebrow,
      trips_section_title: form.trips_section_title,
      trips_section_subtitle: form.trips_section_subtitle,
      intl_section_eyebrow: form.intl_section_eyebrow,
      intl_section_title: form.intl_section_title,
      intl_section_subtitle: form.intl_section_subtitle,
      intl_trips_layout_template: form.intl_trips_layout_template || 'horizontal_scroll',
      intl_trip_card_template: form.intl_trip_card_template || 'abroad_horizontal',
    },
    'Τα κείμενα ενότητας αποθηκεύτηκαν',
  );

  const handleImageUpload = async (kind, e) => {
    const file = e instanceof File ? e : e?.target?.files?.[0];
    if (e && !(e instanceof File) && e?.target && 'value' in e.target) e.target.value = '';
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
    return <p className="text-sm text-gray-500 py-4">Φόρτωση ρυθμίσεων εμφάνισης…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-6 min-w-0">
      <nav className="lg:w-72 shrink-0">
        <div className="lg:sticky lg:top-4 space-y-2">
          <div
            className={`rounded-2xl text-white p-4 mb-4 shadow-lg bg-gradient-to-br ${
              designPage === 'rent'
                ? 'from-teal-700 via-cyan-700 to-sky-900 shadow-teal-500/20'
                : 'from-sky-700 via-indigo-700 to-slate-800 shadow-sky-500/20'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Διαμόρφωση</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-bold text-white/90">
                <span className="material-symbols-outlined text-[12px]">workspace_premium</span>
                {officeMode === 'both' ? '2 σελίδες' : '1 σελίδα'}
              </span>
            </div>
            <p className="font-bold text-lg mt-0.5">{activePageMeta.title}</p>
            <p className="text-xs text-white/75 mt-2 leading-relaxed">{activePageMeta.blurb}</p>
            <p className="mt-2 text-[11px] font-semibold text-white/65">{contractBadge}</p>

            {canSwitchPages ? (
              <div className="mt-4 space-y-1.5" role="tablist" aria-label="Σελίδα προς σχεδιασμό">
                <p className="text-[10px] font-bold uppercase tracking-wide text-white/60 px-0.5">
                  Ποια σελίδα σχεδιάζεις;
                </p>
                {availablePages.map((p) => {
                  const active = designPage === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => selectDesignPage(p.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition ${
                        active
                          ? 'bg-white text-slate-900 shadow-md'
                          : 'bg-white/10 text-white hover:bg-white/15'
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
                          active ? 'bg-slate-900 text-white' : 'bg-black/20 text-white'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">{p.icon}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold leading-tight">{p.label}</span>
                        <span
                          className={`block text-[11px] mt-0.5 leading-snug ${
                            active ? 'text-slate-500' : 'text-white/70'
                          }`}
                        >
                          {p.id === 'home' ? 'Αρχική εκδρομών' : 'App /rent'}
                        </span>
                      </span>
                      {active ? (
                        <span className="material-symbols-outlined text-[18px] text-emerald-600">
                          check_circle
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-black/20 border border-white/10 px-3 py-2.5 flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                  <span className="material-symbols-outlined text-[18px]">{activePageMeta.icon}</span>
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold">{activePageMeta.label}</p>
                  <p className="text-[11px] text-white/70 mt-0.5">
                    Μόνο αυτή η σελίδα στο συμβόλαιό σου
                  </p>
                </div>
              </div>
            )}

            <Link
              to={previewTo}
              target="_blank"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-2 rounded-full transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              {previewLabel}
            </Link>
          </div>

          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
            {navSections.map((s) => (
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
        {designPage === 'rent' ? (
          <>
            {section === 'overview' && (
              <>
                <PanelCard
                  title="Τρέχουσα εμφάνιση /rent"
                  description="Σύνοψη κειμένων της εφαρμογής ενοικίασης. Αλλάξτε τα από «Όνομα & κείμενα»."
                >
                  <div className="grid sm:grid-cols-2 gap-3">
                    {[
                      { label: 'Όνομα γραφείου', value: rentPreview.brandLabel },
                      { label: 'Τίτλος', value: rentPreview.title },
                      { label: 'Κουμπί', value: rentPreview.ctaLabel },
                      {
                        label: 'Περιγραφή',
                        value: rentPreview.copy,
                      },
                      {
                        label: 'Διάταξη στόλου',
                        value: getTemplateById(
                          RENT_FLEET_LAYOUT_TEMPLATES,
                          form.rent_fleet_layout_template || 'rent_grid_three',
                        ).label,
                      },
                      {
                        label: 'Στυλ κάρτας',
                        value: getTemplateById(
                          RENT_FLEET_CARD_TEMPLATES,
                          form.rent_fleet_card_template || 'rent_premium',
                        ).label,
                      },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="rounded-2xl border border-black/[0.06] bg-slate-50/80 p-4"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          {row.label}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-gray-900 line-clamp-3">
                          {row.value || '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                </PanelCard>
                <PanelCard
                  title="Γρήγορη εκκίνηση"
                  description="Επεξεργαστείτε όνομα, τίτλους, κείμενα και hero slider."
                >
                  <div className="grid sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSection('fleet')}
                      className="flex items-center gap-3 p-4 rounded-2xl border border-black/[0.06] hover:border-teal-500/30 hover:shadow-md text-left transition-all bg-white group w-full"
                    >
                      <span className="w-11 h-11 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined">directions_car</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block font-bold text-slate-900 group-hover:text-teal-800">
                          Καρτέλες στόλου
                        </span>
                        <span className="block text-xs text-slate-500 mt-0.5">
                          Διάταξη & στυλ οχημάτων στην αρχική
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSection('copy')}
                      className="flex items-center gap-3 p-4 rounded-2xl border border-black/[0.06] hover:border-teal-500/30 hover:shadow-md text-left transition-all bg-white group w-full"
                    >
                      <span className="w-10 h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                        <span className="material-symbols-outlined">edit_note</span>
                      </span>
                      <span>
                        <span className="font-bold text-gray-900 block">Όνομα & κείμενα</span>
                        <span className="text-xs text-gray-500">Συνδεδεμένος / επισκέπτης · CTA</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSection('slider')}
                      className="flex items-center gap-3 p-4 rounded-2xl border border-black/[0.06] hover:border-teal-500/30 hover:shadow-md text-left transition-all bg-white group w-full"
                    >
                      <span className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                        <span className="material-symbols-outlined">slideshow</span>
                      </span>
                      <span>
                        <span className="font-bold text-gray-900 block">Slider</span>
                        <span className="text-xs text-gray-500">Hero φωτογραφίες · autoplay</span>
                      </span>
                    </button>
                  </div>
                </PanelCard>
              </>
            )}
            {section === 'copy' && (
              <PanelCard
                title="Όνομα & κείμενα /rent"
                description="Εμφανίζονται αμέσως στην εφαρμογή ενοικίασης μετά την αποθήκευση."
              >
                <RentAppBrandingEditor
                  embedded
                  onSaved={(appearance) => {
                    if (appearance) setForm((p) => ({ ...p, ...appearance }));
                  }}
                />
              </PanelCard>
            )}

            {section === 'fleet' && (
              <>
                <form onSubmit={saveRentFleetLayout}>
                  <PanelCard
                    title="Διάταξη στόλου ενοικίασης"
                    description="Πώς εμφανίζονται τα οχήματα στο block ενοικίασης της αρχικής / στο storefront."
                    action={<SaveButton saving={saving} label="Αποθήκευση διάταξης" />}
                  >
                    <TemplatePicker
                      category="rent_fleet_layout"
                      templates={RENT_FLEET_LAYOUT_TEMPLATES}
                      value={form.rent_fleet_layout_template || 'rent_grid_three'}
                      onChange={(id) => setForm((p) => ({ ...p, rent_fleet_layout_template: id }))}
                      accent="teal"
                    />
                  </PanelCard>
                </form>
                <form onSubmit={saveRentFleetLayout} className="mt-6">
                  <PanelCard
                    title="Στυλ κάρτας οχήματος"
                    description="Premium showroom, overlay, συμπαγής λίστα ή spec sheet — επιλέξτε εμφάνιση κάρτας."
                    action={<SaveButton saving={saving} label="Αποθήκευση στυλ" />}
                  >
                    <TemplatePicker
                      category="rent_fleet_card"
                      templates={RENT_FLEET_CARD_TEMPLATES}
                      value={form.rent_fleet_card_template || 'rent_premium'}
                      onChange={(id) => setForm((p) => ({ ...p, rent_fleet_card_template: id }))}
                      accent="teal"
                      columns={3}
                    />
                  </PanelCard>
                </form>
              </>
            )}

            {section === 'slider' && (
          <PanelCard
            title="Hero Slider · Ενοικιάσεις"
            description="Soliloquy-style builder για /rent — drag & drop, captions, transitions, thumbnails, lightbox, schedule."
          >
            <PageSliderEditor
              page="rent"
              enabled={Boolean(form.rent_slider_enabled)}
              autoplay={form.rent_slider_autoplay !== false}
              intervalSec={form.rent_slider_interval_sec}
              options={form.rent_slider_options}
              slides={form.rent_slider_slides}
              saving={saving}
              onChange={(next) =>
                setForm((p) => ({
                  ...p,
                  ...pageSliderPatch('rent', next),
                }))
              }
              onSave={() =>
                patchForm(
                  pageSliderPatch('rent', {
                    enabled: Boolean(form.rent_slider_enabled),
                    autoplay: form.rent_slider_autoplay !== false,
                    interval_sec: form.rent_slider_interval_sec,
                    options: form.rent_slider_options,
                    slides: form.rent_slider_slides,
                  }),
                  'Το slider ενοικιάσεων αποθηκεύτηκε',
                )()
              }
            />
              </PanelCard>
            )}
          </>
        ) : null}

        {designPage === 'home' && section === 'overview' && (
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
                {HOME_SECTIONS.filter((s) => s.id !== 'overview').map((s) => (
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

        {designPage === 'home' && section === 'themes' && (
          <PanelCard
            title="Θέματα αρχικής σελίδας"
            description="Επίλεξε θέμα — εφαρμόζει χρώματα, header, hero, κάρτες και footer μαζί."
          >
            <ThemeGallery
              activeThemeId={form.homepage_theme_id || 'aegean_classic'}
              onPreview={handleThemePreview}
              onApply={handleThemeApply}
              applying={saving}
            />
          </PanelCard>
        )}

        {designPage === 'home' && section === 'general' && (
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
                  <div className="flex flex-wrap items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-black/[0.06]">
                    <div className="flex -space-x-1.5 shrink-0" aria-hidden>
                      {[form.accent_color || '#0ea5e9', form.secondary_color || '#1e3a5f', form.surface_color || '#f8fafc'].map(
                        (c, i) => (
                          <span
                            key={`${c}-${i}`}
                            className="w-10 h-10 rounded-xl border-2 border-white shadow-sm"
                            style={{ background: c }}
                          />
                        ),
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-900">{getHomepageThemeById(form.homepage_theme_id).nameEl}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                        {getHomepageThemeById(form.homepage_theme_id).description}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSection('themes')}
                        className="text-xs font-bold text-primary hover:underline mt-1"
                      >
                        Αλλαγή θέματος →
                      </button>
                    </div>
                  </div>
                </div>

                <BrandColorEditor
                  accent={form.accent_color}
                  secondary={form.secondary_color}
                  surface={form.surface_color}
                  themeName={getHomepageThemeById(form.homepage_theme_id).nameEl}
                  onChange={(patch) => setForm((p) => ({ ...p, ...patch }))}
                  onResetTheme={() => {
                    const theme = getHomepageThemeById(form.homepage_theme_id);
                    setForm((p) => ({
                      ...p,
                      accent_color: theme.palette.primary,
                      secondary_color: theme.palette.secondary,
                      surface_color: theme.palette.surface,
                    }));
                    toast.success('Χρώματα από το ενεργό θέμα');
                  }}
                />

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Ενότητες σελίδας</p>
                  <div className="space-y-3">
                    {[
                      {
                        key: 'show_fleet_section',
                        label: 'Εμφάνιση στόλου',
                        hint: 'Premium λεωφορεία & παροχές',
                        icon: 'directions_bus',
                      },
                      {
                        key: 'show_why_us_section',
                        label: 'Εμφάνιση «Γιατί να μας επιλέξετε»',
                        hint: 'Τα 3 πλεονεκτήματα κάτω από τις εκδρομές',
                        icon: 'star',
                      },
                    ].map(({ key, label, hint, icon }) => {
                      const on = form[key] !== false;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, [key]: !on }))}
                          className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-colors ${
                            on
                              ? 'border-primary/25 bg-primary/[0.04]'
                              : 'border-black/[0.06] bg-white hover:border-primary/20'
                          }`}
                        >
                          <span
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              on ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[22px]">{icon}</span>
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-gray-900 text-sm block">{label}</span>
                            <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
                          </div>
                          <span
                            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                              on ? 'bg-primary' : 'bg-slate-200'
                            }`}
                            aria-hidden
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                                on ? 'translate-x-5' : ''
                              }`}
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </PanelCard>
          </form>
        )}

        {designPage === 'home' && section === 'header' && (
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

        {designPage === 'home' && section === 'hero' && (
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

              <HeroTextsBlock form={form} setForm={setForm} />
            </PanelCard>
          </form>
        )}

        {designPage === 'home' && section === 'slider' && (
          <PanelCard
            title="Hero Slider · Λεωφορεία"
            description="Soliloquy-style builder — drag & drop εικόνες, captions/SEO, transitions, thumbnails, lightbox και προγραμματισμός διαφανειών."
          >
            <PageSliderEditor
              page="home"
              enabled={Boolean(form.home_slider_enabled)}
              autoplay={form.home_slider_autoplay !== false}
              intervalSec={form.home_slider_interval_sec}
              options={form.home_slider_options}
              slides={form.home_slider_slides}
              saving={saving}
              onChange={(next) =>
                setForm((p) => ({
                  ...p,
                  ...pageSliderPatch('home', next),
                }))
              }
              onSave={() =>
                patchForm(
                  pageSliderPatch('home', {
                    enabled: Boolean(form.home_slider_enabled),
                    autoplay: form.home_slider_autoplay !== false,
                    interval_sec: form.home_slider_interval_sec,
                    options: form.home_slider_options,
                    slides: form.home_slider_slides,
                  }),
                  'Το slider λεωφορείων αποθηκεύτηκε',
                )()
              }
            />
          </PanelCard>
        )}

        {designPage === 'home' && section === 'trips' && (
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

            <form onSubmit={saveLayout} className="mt-6">
              <PanelCard
                title="Εξωτερικό — οριζόντια κάρτα"
                description="Ξεχωριστή διάταξη και κάρτα μόνο για διεθνείς εκδρομές. Δεν αλλάζει τις εκδρομές Ελλάδας."
                action={<SaveButton saving={saving} label="Αποθήκευση εξωτερικού" />}
              >
                <div className="space-y-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-sky-600 mb-3">
                      Διάταξη εξωτερικού
                    </p>
                    <TemplatePicker
                      category="trips_layout"
                      templates={TRIPS_LAYOUT_TEMPLATES}
                      value={form.intl_trips_layout_template || 'horizontal_scroll'}
                      onChange={(id) =>
                        setForm((p) => ({ ...p, intl_trips_layout_template: id }))
                      }
                    />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-sky-600 mb-3">
                      Κάρτα εξωτερικού
                    </p>
                    <TemplatePicker
                      category="trip_card"
                      templates={TRIP_CARD_TEMPLATES}
                      value={form.intl_trip_card_template || 'abroad_horizontal'}
                      onChange={(id) =>
                        setForm((p) => ({
                          ...p,
                          intl_trip_card_template: id,
                          ...(id === 'abroad_horizontal'
                            ? { intl_trips_layout_template: 'horizontal_scroll' }
                            : {}),
                        }))
                      }
                      columns={4}
                    />
                  </div>
                </div>
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

        {designPage === 'home' && section === 'branding' && (
          <form
            onSubmit={patchForm(
              {
                logo_url: form.logo_url,
                logo_height_px: clampLogoHeight(form.logo_height_px),
                logo_max_width_px: clampLogoMaxWidth(form.logo_max_width_px),
                logo_show_name: form.logo_show_name !== false,
                hero_image_url: form.hero_image_url,
                hero_image_focal: form.hero_image_focal || 'center',
              },
              'Οι ρυθμίσεις λογοτύπου αποθηκεύτηκαν',
            )}
          >
            <PanelCard
              title="Λογότυπο & εικόνες"
              description="Μέγεθος, προεπισκόπηση light/dark, URL και hero φωτογραφία."
              action={<SaveButton saving={saving} label="Αποθήκευση λογοτύπου" />}
            >
              <div className="space-y-6">
                <LogoBlock
                  form={form}
                  setForm={setForm}
                  previewUrl={logoPreview}
                  uploading={uploadingLogo}
                  hasCustom={hasCustomLogo}
                  onUpload={(e) => handleImageUpload('logo', e)}
                  onClear={() => handleClearAsset('logo')}
                  onApplyUrl={(url) => {
                    setForm((p) => ({ ...p, logo_url: url }));
                    toast.success('Το URL ορίστηκε — πατήστε Αποθήκευση');
                  }}
                />
                <HeroImageBlock
                  previewUrl={heroPreview}
                  uploading={uploadingHero}
                  hasCustom={hasCustomHero}
                  focal={form.hero_image_focal || 'center'}
                  heroTitle={form.hero_title}
                  heroAccent={form.hero_title_accent}
                  onUpload={(e) => handleImageUpload('hero', e)}
                  onClear={() => handleClearAsset('hero')}
                  onFocalChange={(id) => setForm((p) => ({ ...p, hero_image_focal: id }))}
                  onApplyUrl={(url) => {
                    setForm((p) => ({ ...p, hero_image_url: url }));
                    toast.success('Το URL ορίστηκε — πατήστε Αποθήκευση λογοτύπου');
                  }}
                />
              </div>
            </PanelCard>
          </form>
        )}

        {designPage === 'home' && section === 'footer' && (
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
              description="Το κάτω μέρος της αρχικής — λογότυπο γραφείου, επωνυμία και κείμενα που επεξεργάζεστε εδώ."
              action={<SaveButton saving={saving} label="Αποθήκευση footer" />}
            >
              <TemplatePicker
                category="footer"
                templates={FOOTER_TEMPLATES}
                value={form.footer_template}
                onChange={(id) => setForm((p) => ({ ...p, footer_template: id }))}
              />

              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                Το <strong>λογότυπο</strong> στο footer έρχεται από την ενότητα «Λογότυπο & εικόνες».
                Συμπληρώστε επωνυμία / copyright παρακάτω — όχι AeroStride / PoreiaGo.
              </div>

              <div className="mt-8 pt-8 border-t border-black/[0.06] grid md:grid-cols-2 gap-4">
                <label className="block text-sm md:col-span-2">
                  <span className="font-bold text-gray-700">Επωνυμία γραφείου (footer)</span>
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    placeholder="π.χ. Achillio Travel"
                    value={form.footer_brand_name}
                    onChange={(e) => setForm((p) => ({ ...p, footer_brand_name: e.target.value }))}
                  />
                </label>
                <label className="block text-sm md:col-span-2">
                  <span className="font-bold text-gray-700">Copyright / κείμενο κάτω</span>
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    placeholder="π.χ. © 2026 Achillio Travel"
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
    </div>
  );
}
