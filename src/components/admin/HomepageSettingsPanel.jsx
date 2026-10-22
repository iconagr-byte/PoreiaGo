import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import TemplatePicker from './homepage/TemplatePicker.jsx';
import ThemeGallery, { isHomepageThemesPlaceholder } from './homepage/ThemeGallery.jsx';
import RentThemeGallery from './homepage/RentThemeGallery.jsx';
import PageDesignWizardShell from './homepage/PageDesignWizardShell.jsx';
import PageDesignBuilderPanel, {
  isPageDesignBuilderSection,
} from './homepage/PageDesignBuilderPanel.jsx';
import '../../styles/page-design-wizard.css';
import BrandColorEditor from './homepage/BrandColorEditor.jsx';
import RentAppBrandingEditor from './fleet/RentAppBrandingEditor.jsx';
import RentBrandDesigner from './RentBrandDesigner.jsx';
import PageSliderEditor from './homepage/PageSliderEditor.jsx';
import HeroImageBlock from './homepage/HeroImageBlock.jsx';
import {
  RENT_FLEET_CARD_TEMPLATES,
  RENT_FLEET_LAYOUT_TEMPLATES,
} from '../../lib/homepage/homepageTemplates.js';
import {
  themeToAppearancePatch,
} from '../../lib/homepage/homepageThemes.js';
import {
  getRentThemeById,
  rentThemeToAppearancePatch,
} from '../../lib/rental/rentThemes.js';
import { pushHomepagePreviewDraft } from '../../lib/homepage/homepagePreview.js';
import {
  PDW_BRIDGE,
  postPdwBridge,
  subscribePdwBridge,
} from '../../lib/homepage/pageDesignBridge.js';
import { pageSliderPatch } from '../../lib/homepage/pageSlider.js';
import { fileToTripCoverDataUrl, TRIP_COVER_ACCEPT } from '../../lib/trips/tripImage.js';
import { fileToLogoDataUrl } from '../../lib/branding/logoImage.js';
import { dataUrlToFile } from '../../lib/branding/dataUrlToFile.js';
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
  clampLogoPadding,
  clampLogoRadius,
  normalizeLogoBgMode,
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
    previewLabel: 'Άνοιγμα αρχικής',
    previewSrc: '/storefront?preview=1',
    previewPathLabel: '/storefront?preview=1',
    openSiteHref: '/storefront',
    platformPreviewTo: '/',
    platformPreviewLabel: 'Αρχική PoreiaGo (χωρίς storefront γραφείου)',
    platformPreviewSrc: '/?preview=1',
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
    previewTo: '/rent?preview=1',
    previewLabel: 'Άνοιγμα /rent',
    previewSrc: '/rent?preview=1',
    previewPathLabel: '/rent?preview=1',
    openSiteHref: '/rent',
    icon: 'car_rental',
    accentFrom: 'from-teal-700',
    accentVia: 'via-cyan-700',
    accentTo: 'to-sky-900',
  },
];

const HOME_SECTIONS = [
  { id: 'themes', label: 'Θέματα', icon: 'palette', accent: 'bg-fuchsia-500' },
  { id: 'general', label: 'Γενικά', icon: 'tune', accent: 'bg-slate-600' },
  { id: 'header', label: 'Header', icon: 'web_asset', accent: 'bg-sky-500' },
  { id: 'hero', label: 'Hero', icon: 'panorama', accent: 'bg-indigo-500' },
  { id: 'slider', label: 'Slider', icon: 'slideshow', accent: 'bg-cyan-600' },
  { id: 'trips', label: 'Καρτέλες', icon: 'view_carousel', accent: 'bg-emerald-500' },
  { id: 'branding', label: 'Μάρκα', icon: 'image', accent: 'bg-amber-500' },
  { id: 'footer', label: 'Footer', icon: 'vertical_align_bottom', accent: 'bg-rose-500' },
];

const RENT_SECTIONS = [
  { id: 'themes', label: 'Θέματα', icon: 'palette', accent: 'bg-fuchsia-500' },
  { id: 'branding', label: 'Μάρκα', icon: 'image', accent: 'bg-amber-500' },
  { id: 'copy', label: 'Κείμενα', icon: 'edit_note', accent: 'bg-cyan-600' },
  { id: 'fleet', label: 'Στόλος', icon: 'directions_car', accent: 'bg-sky-600' },
  { id: 'slider', label: 'Slider', icon: 'slideshow', accent: 'bg-emerald-600' },
];

const DEFAULT_SECTION = 'themes';

function sanitizeDesignPage(value) {
  return value === 'rent' ? 'rent' : 'home';
}

function PanelCard({ title, description, children, action }) {
  return (
    <div className="page-design-wizard__panel">
      <div className="page-design-wizard__panel-head">
        <div className="min-w-0 flex-1">
          <h4 className="page-design-wizard__panel-title">{title}</h4>
          {description && <p className="page-design-wizard__panel-desc">{description}</p>}
        </div>
        {action ? <div className="page-design-wizard__panel-action">{action}</div> : null}
      </div>
      <div className="page-design-wizard__panel-body">{children}</div>
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
}) {
  const [previewTone, setPreviewTone] = useState('light');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const height = clampLogoHeight(form.logo_height_px);
  const maxWidth = clampLogoMaxWidth(form.logo_max_width_px);
  const radius = clampLogoRadius(form.logo_radius_px);
  const padding = clampLogoPadding(form.logo_padding_px);
  const bgMode = normalizeLogoBgMode(form.logo_bg_mode);
  const shadowOn = form.logo_shadow === true;
  const logoStyle = officeLogoImageStyle(form);
  const brandName = (form.footer_brand_name || '').trim();
  const showName = form.logo_show_name !== false;

  const pickFile = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const onDropFile = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    onUpload({ target: { files: [file], value: '' } });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-black/[0.04] bg-slate-50/80">
          <h5 className="font-bold text-slate-900">Επωνυμία γραφείου</h5>
          <p className="text-xs text-slate-500 mt-0.5">
            Εμφανίζεται στο header και στο footer της αρχικής — αντί για το γενικό «Γραφείο»
          </p>
        </div>
        <div className="p-5 space-y-3">
          <label className="block">
            <span className="sr-only">Επωνυμία γραφείου</span>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[15px] font-semibold text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              placeholder="π.χ. Achillio Travel"
              value={form.footer_brand_name || ''}
              onChange={(e) => setForm((p) => ({ ...p, footer_brand_name: e.target.value }))}
              maxLength={80}
              autoComplete="organization"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0ea5e9] to-[#0f766e] text-sm font-bold text-white shadow-sm"
              aria-hidden
            >
              {(brandName || 'Γ').charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold tracking-tight text-slate-900">
                {brandName || 'Γραφείο'}
              </p>
              <p className="text-[11px] text-slate-500">
                {brandName ? 'Προεπισκόπηση header' : 'Συμπληρώστε επωνυμία για να φύγει το «Γραφείο»'}
              </p>
            </div>
          </div>
        </div>
      </div>

    <div className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-black/[0.04] bg-slate-50/80">
        <h5 className="font-bold text-slate-900">Λογότυπο</h5>
        <p className="text-xs text-slate-500 mt-0.5">
          PNG, JPG ή WebP · εμφανίζεται στο header και footer
        </p>
      </div>

      <div className="p-5 grid lg:grid-cols-[240px_1fr] gap-6">
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
            role="button"
            tabIndex={0}
            aria-label="Ανέβασμα λογοτύπου"
            className={`relative h-44 rounded-xl overflow-hidden border flex items-center justify-center px-4 transition ${
              uploading ? 'cursor-wait opacity-80' : 'cursor-pointer'
            } ${
              dragOver ? 'border-sky-400 bg-sky-50' : 'border-slate-200 hover:border-sky-300'
            } ${previewTone === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}`}
            onClick={pickFile}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                pickFile();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDropFile}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={TRIP_COVER_ACCEPT}
              className="hidden"
              disabled={uploading}
              onChange={onUpload}
            />
            {previewUrl ? (
              <span className="inline-flex items-center gap-2.5 max-w-full pointer-events-none">
                <img src={previewUrl} alt="" style={logoStyle} className="object-contain" />
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
                className={`flex flex-col items-center gap-1 pointer-events-none ${
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

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={pickFile}
              disabled={uploading}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold cursor-pointer hover:bg-slate-800 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">upload</span>
              {hasCustom ? 'Αλλαγή' : 'Ανέβασμα'}
            </button>
            {hasCustom && (
              <button
                type="button"
                onClick={onClear}
                disabled={uploading}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                Αφαίρεση
              </button>
            )}
          </div>

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
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Στυλ</p>
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-sm font-semibold text-slate-800">Στρογγύλεμα</span>
                <span className="tabular-nums text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-md px-2 py-0.5">
                  {radius}px
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={48}
                step={2}
                value={radius}
                onChange={(e) => setForm((p) => ({ ...p, logo_radius_px: Number(e.target.value) }))}
                className="w-full h-1.5 rounded-full appearance-none bg-slate-200 accent-slate-900 cursor-pointer"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[
                  { label: 'Ορθό', value: 0 },
                  { label: 'Ήπιο', value: 8 },
                  { label: 'Στρογγυλό', value: 16 },
                  { label: 'Κύκλος', value: 48 },
                ].map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, logo_radius_px: preset.value }))}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                      radius === preset.value
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-sm font-semibold text-slate-800">Εσωτερικό κενό</span>
                <span className="tabular-nums text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-md px-2 py-0.5">
                  {padding}px
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={24}
                step={2}
                value={padding}
                onChange={(e) => setForm((p) => ({ ...p, logo_padding_px: Number(e.target.value) }))}
                className="w-full h-1.5 rounded-full appearance-none bg-slate-200 accent-slate-900 cursor-pointer"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 mb-2">Φόντο</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'none', label: 'Κανένα' },
                  { id: 'white', label: 'Λευκό' },
                  { id: 'soft', label: 'Απαλό' },
                  { id: 'dark', label: 'Σκούρο' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, logo_bg_mode: opt.id }))}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                      bgMode === opt.id
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={shadowOn}
              onClick={() => setForm((p) => ({ ...p, logo_shadow: !p.logo_shadow }))}
              className={`w-full flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                shadowOn ? 'border-slate-900/15 bg-white' : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">Ήπια σκιά</p>
                <p className="text-xs text-slate-500 mt-0.5">Δίνει βάθος στο λογότυπο</p>
              </div>
              <span
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  shadowOn ? 'bg-slate-900' : 'bg-slate-300'
                }`}
                aria-hidden
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    shadowOn ? 'translate-x-5' : ''
                  }`}
                />
              </span>
            </button>
          </div>

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
                {brandName || 'Ορίστε επωνυμία παραπάνω'}
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
        </div>
      </div>
    </div>
    </div>
  );
}

function SaveButton({ saving, label = 'Αποθήκευση ενότητας', primary = false }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className={
        primary ? 'page-design-wizard__save' : 'page-design-wizard__save page-design-wizard__save--section'
      }
      title="Αποθηκεύει μόνο αυτή την ενότητα. Για τα πάντα χρησιμοποίησε «Αποθήκευση» πάνω δεξιά."
    >
      <span className="material-symbols-outlined text-[16px]" aria-hidden>
        {saving ? 'progress_activity' : 'save'}
      </span>
      {saving ? 'Αποθήκευση…' : label}
    </button>
  );
}

function sanitizeSection(value, sections) {
  const ids = sections.map((s) => s.id);
  if (value && value !== 'overview' && ids.includes(value)) return value;
  return ids.includes(DEFAULT_SECTION) ? DEFAULT_SECTION : ids[0] || DEFAULT_SECTION;
}

export default function HomepageSettingsPanel({ initialDesignPage } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const pageFromQuery = searchParams.get('page') || searchParams.get('designPage');
  const sectionFromQuery = searchParams.get('section');
  const [modules, setModules] = useState(DEFAULT_OFFICE_MODULES);
  const [modulesReady, setModulesReady] = useState(false);
  const officeMode = officeModeFromModules(modules);
  const [designPage, setDesignPage] = useState(() =>
    sanitizeDesignPage(initialDesignPage || pageFromQuery),
  );
  const [section, setSection] = useState(DEFAULT_SECTION);
  const [form, setForm] = useState({ ...DEFAULT_SITE_APPEARANCE });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [previewRefreshToken, setPreviewRefreshToken] = useState(0);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const savedSnapshotRef = useRef(null);

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

  const navSections = designPage === 'rent' ? RENT_SECTIONS : HOME_SECTIONS;

  const selectSection = useCallback(
    (id) => {
      const next = sanitizeSection(id, navSections);
      setSection(next);
      const params = new URLSearchParams(searchParams);
      if (next === DEFAULT_SECTION) params.delete('section');
      else params.set('section', next);
      setSearchParams(params, { replace: true });
    },
    [navSections, searchParams, setSearchParams],
  );

  // Sync left-nav ↔ Divi-like inline Builder in the preview iframe.
  useEffect(() => {
    if (designPage !== 'home') return undefined;
    postPdwBridge({ type: PDW_BRIDGE.SECTION_FOCUS, section });
    return undefined;
  }, [designPage, section]);

  useEffect(() => {
    if (designPage !== 'home') return undefined;
    return subscribePdwBridge((msg) => {
      if (msg.type === PDW_BRIDGE.SELECT_SECTION && msg.section) {
        selectSection(msg.section);
        return;
      }
      if (msg.type === PDW_BRIDGE.REQUEST_THEMES) {
        selectSection('themes');
        return;
      }
      if (msg.type === PDW_BRIDGE.APPEARANCE_SYNC && msg.appearance && typeof msg.appearance === 'object') {
        setForm((prev) => {
          const next = { ...prev, ...msg.appearance };
          return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
        });
      }
    });
  }, [designPage, selectSection]);

  useEffect(() => {
    const raw = sectionFromQuery || DEFAULT_SECTION;
    setSection((prev) => {
      const next = sanitizeSection(raw, navSections);
      return prev === next ? prev : next;
    });
  }, [sectionFromQuery, navSections]);

  useEffect(() => {
    if (sectionFromQuery !== 'overview') return;
    const params = new URLSearchParams(searchParams);
    params.delete('section');
    setSearchParams(params, { replace: true });
  }, [sectionFromQuery, searchParams, setSearchParams]);

  const selectDesignPage = (id) => {
    const next = resolveDesignPageForModules(id, modules);
    setDesignPage(next);
    setSection(DEFAULT_SECTION);
    const params = new URLSearchParams(searchParams);
    if (next === 'rent') params.set('page', 'rent');
    else params.delete('page');
    params.delete('designPage');
    params.delete('section');
    setSearchParams(params, { replace: true });
  };

  const availablePages = DESIGN_PAGES.filter((p) => {
    if (officeMode === 'rent_only') return p.id === 'rent';
    if (officeMode === 'trips_only') return p.id === 'home';
    return true;
  });
  const canSwitchPages = availablePages.length > 1;
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
  const previewSrc =
    onPlatformHost && activePageMeta.platformPreviewSrc
      ? activePageMeta.platformPreviewSrc
      : activePageMeta.previewSrc || previewTo;
  const previewPathLabel = activePageMeta.previewPathLabel || previewSrc;
  const openSiteHref =
    onPlatformHost && activePageMeta.platformPreviewTo
      ? activePageMeta.platformPreviewTo
      : activePageMeta.openSiteHref || previewTo;
  const copyLinkHref =
    typeof window !== 'undefined'
      ? `${window.location.origin}${String(openSiteHref || '/').split('?')[0]}`
      : openSiteHref;
  const rentPreview = resolveRentAppBranding(form, { guest: false });
  const contractBadge = contractDesignLabel(officeMode);
  const brandName =
    (form.footer_brand_name || form.display_name || rentPreview.brandLabel || '').trim();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminSiteAppearance();
      const next = { ...DEFAULT_SITE_APPEARANCE, ...data };
      setForm(next);
      savedSnapshotRef.current = JSON.stringify(next);
      setDirty(false);
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
      if (savedSnapshotRef.current != null) {
        setDirty(JSON.stringify(form) !== savedSnapshotRef.current);
      }
    }
  }, [form, loading]);

  const markSaved = useCallback((nextForm) => {
    const snapshot = JSON.stringify(nextForm);
    savedSnapshotRef.current = snapshot;
    setDirty(false);
    setPreviewRefreshToken((n) => n + 1);
  }, []);

  const saveAll = useCallback(async () => {
    setSaving(true);
    try {
      const result = await updateSiteAppearance(form);
      const next = { ...form, ...result.data };
      setForm(next);
      markSaved(next);
      if (result.offline) {
        toast.success('Αποθηκεύτηκε τοπικά — ο server δεν είναι διαθέσιμος αυτή τη στιγμή', {
          id: 'homepage-save-all-offline',
        });
      } else {
        toast.success('Οι ρυθμίσεις εμφάνισης αποθηκεύτηκαν', { id: 'homepage-save-all-ok' });
      }
    } catch (err) {
      if (err.message === 'AUTH_EXPIRED') return;
      toast.error(err.message || 'Αποτυχία αποθήκευσης', { id: 'homepage-save-all-err' });
    } finally {
      setSaving(false);
    }
  }, [form, markSaved]);

  const handleThemePreview = (theme, { includeColors = false } = {}) => {
    // Sync draft to localStorage BEFORE the live preview iframe mounts
    // (same flow as /rent themes). Do not mutate form — only Apply saves.
    const patch = themeToAppearancePatch(theme, { includeColors });
    const draft = { ...form, ...patch };
    pushHomepagePreviewDraft(draft);
  };

  const handleThemeApply = async (theme, { includeColors = false } = {}) => {
    const patch = themeToAppearancePatch(theme, { includeColors });
    setForm((p) => ({ ...p, ...patch }));
    setSaving(true);
    try {
      const result = await updateSiteAppearance(patch);
      let next = null;
      setForm((p) => {
        next = { ...p, ...result.data };
        return next;
      });
      if (next) markSaved(next);
      if (result.offline) {
        toast.success('Το θέμα αποθηκεύτηκε τοπικά', { id: 'theme-apply' });
      } else {
        toast.success(includeColors ? `Εφαρμόστηκε διάταξη + χρώματα «${theme.nameEl}»` : `Εφαρμόστηκε διάταξη «${theme.nameEl}» — ρύθμισε χρώματα στα Γενικά`, { id: 'theme-apply' });
      }
    } catch (err) {
      if (err.message === 'AUTH_EXPIRED') return;
      toast.error(err.message || 'Αποτυχία εφαρμογής θέματος', { id: 'theme-apply-err' });
    } finally {
      setSaving(false);
    }
  };

  const handleRentThemePreview = (theme, { includeColors = false } = {}) => {
    // Sync draft to localStorage BEFORE the live preview iframe mounts.
    // Do not mutate form selection — only Apply saves / marks Ενεργό.
    const patch = rentThemeToAppearancePatch(theme, { includeColors });
    const draft = { ...form, ...patch };
    pushHomepagePreviewDraft(draft);
  };

  const handleRentThemeApply = async (theme, { includeColors = false } = {}) => {
    const patch = rentThemeToAppearancePatch(theme, { includeColors });
    setForm((p) => ({ ...p, ...patch }));
    setSaving(true);
    try {
      const result = await updateSiteAppearance(patch);
      let next = null;
      setForm((p) => {
        next = { ...p, ...result.data, ...patch };
        return next;
      });
      if (next) markSaved(next);
      toast.success(
        includeColors
          ? `Εφαρμόστηκε θέμα /rent «${theme.nameEl}» + χρώματα`
          : `Εφαρμόστηκε θέμα /rent «${theme.nameEl}» — ρύθμισε χρώματα από κάτω`,
        { id: 'rent-theme-apply' },
      );
    } catch (err) {
      if (err.message === 'AUTH_EXPIRED') return;
      toast.error(err.message || 'Αποτυχία εφαρμογής θέματος /rent', {
        id: 'rent-theme-apply-err',
      });
    } finally {
      setSaving(false);
    }
  };

  const patchForm = (patch, successMsg) => async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      const result = await updateSiteAppearance(patch);
      // Prefer the values we just saved if the API response omits layout keys.
      let next = null;
      setForm((p) => {
        next = { ...p, ...result.data, ...patch };
        return next;
      });
      if (next) markSaved(next);
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

  const saveRentFleetLayout = patchForm(
    {
      rent_fleet_layout_template: form.rent_fleet_layout_template || 'rent_grid_three',
      rent_fleet_card_template: form.rent_fleet_card_template || 'rent_premium',
    },
    'Τα πρότυπα στόλου ενοικίασης αποθηκεύτηκαν',
  );

  const assetUrlKey = (kind) =>
    kind === 'logo' ? 'logo_url' : kind === 'rent_logo' ? 'rent_logo_url' : 'hero_image_url';

  const handleImageUpload = async (kind, e) => {
    const file = e instanceof File ? e : e?.target?.files?.[0];
    if (e && !(e instanceof File) && e?.target && 'value' in e.target) e.target.value = '';
    if (!file) return;
    const key = assetUrlKey(kind);
    const previousUrl = form[key];
    const setUploading =
      kind === 'logo' || kind === 'rent_logo' ? setUploadingLogo : setUploadingHero;
    setUploading(true);
    try {
      // Optimistic local preview while the server compresses + stores the file.
      try {
        const preview =
          kind === 'hero' ? await fileToTripCoverDataUrl(file) : await fileToLogoDataUrl(file);
        setForm((p) => ({ ...p, [key]: preview }));
      } catch {
        /* preview optional */
      }

      const result = await uploadSiteAsset(kind, file);
      const url = result?.url;
      if (!url) throw new Error('Δεν επιστράφηκε URL από τον server');
      setForm((p) => ({
        ...p,
        ...(result?.appearance || {}),
        [key]: url,
      }));
      toast.success(
        kind === 'hero'
          ? 'Η φωτογραφία hero ενημερώθηκε'
          : kind === 'rent_logo'
            ? 'Το λογότυπο /rent ενημερώθηκε'
            : 'Το λογότυπο ενημερώθηκε',
      );
    } catch (err) {
      // Roll back optimistic data: preview so Save is not stuck.
      setForm((p) => ({ ...p, [key]: previousUrl }));
      if (err.message === 'AUTH_EXPIRED') {
        toast.error('Η συνεδρία έληξε — συνδεθείτε ξανά και δοκιμάστε το ανέβασμα');
        return;
      }
      const msg = String(err.message || '');
      if (/heic|heif|decode|μη έγκυρη|could not decode|invalid image|μόνο αρχεία/i.test(msg)) {
        toast.error('Μη υποστηριζόμενη εικόνα — δοκιμάστε JPG ή PNG');
        return;
      }
      if (/internal server error|αποτυχία αποθήκευσης|αποτυχία επεξεργασίας|404/i.test(msg)) {
        toast.error('Σφάλμα server στο ανέβασμα — δοκιμάστε μικρότερο JPG/PNG');
        return;
      }
      toast.error(msg || 'Αποτυχία ανεβάσματος');
    } finally {
      setUploading(false);
    }
  };

  const handleClearAsset = async (kind) => {
    const setUploading =
      kind === 'logo' || kind === 'rent_logo' ? setUploadingLogo : setUploadingHero;
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
  const hasCustomRentLogo = Boolean(form.rent_logo_url);
  const heroPreview = resolveSiteAssetUrl(form.hero_image_url);
  const hasCustomLogo = Boolean(form.logo_url);
  const hasCustomHero =
    form.hero_image_url && form.hero_image_url !== DEFAULT_SITE_APPEARANCE.hero_image_url;

  if (loading) {
    return (
      <div className="page-design-wizard">
        <p className="text-sm text-[#6e6e73] py-4">Φόρτωση ρυθμίσεων εμφάνισης…</p>
      </div>
    );
  }

  const sectionContent = (
    <div className="space-y-6 min-w-0">
        {designPage === 'rent' ? (
          <>
            {section === 'themes' && (
              <>
                <PanelCard
                  title="Θέματα σελίδας /rent"
                  description="20 διαφορετικές πλήρεις σελίδες — επίλεξε διάταξη, μετά ρύθμισε τα χρώματα."
                >
                  <RentThemeGallery
                    activeThemeId={form.rent_theme_id || 'aegean_coast'}
                    onPreview={handleRentThemePreview}
                    onApply={handleRentThemeApply}
                    applying={saving}
                  />
                </PanelCard>
                <form
                  onSubmit={patchForm(
                    {
                      rent_accent_color: form.rent_accent_color,
                      rent_secondary_color: form.rent_secondary_color,
                      rent_surface_color: form.rent_surface_color,
                    },
                    'Τα χρώματα /rent αποθηκεύτηκαν',
                  )}
                >
                  <PanelCard
                    title="2. Χρώματα μετά το θέμα"
                    description="Άλλαξε accent, secondary και surface χωρίς να χαλάσει η διάταξη που επέλεξες."
                    action={<SaveButton saving={saving} label="Αποθήκευση ενότητας" />}
                  >
                    <BrandColorEditor
                      accent={
                        form.rent_accent_color ||
                        getRentThemeById(form.rent_theme_id || 'aegean_coast').palette.primary
                      }
                      secondary={
                        form.rent_secondary_color ||
                        getRentThemeById(form.rent_theme_id || 'aegean_coast').palette.secondary
                      }
                      surface={
                        form.rent_surface_color ||
                        getRentThemeById(form.rent_theme_id || 'aegean_coast').palette.surface
                      }
                      themeName={getRentThemeById(form.rent_theme_id || 'aegean_coast').nameEl}
                      onChange={(patch) =>
                        setForm((p) => ({
                          ...p,
                          rent_accent_color: patch.accent_color ?? p.rent_accent_color,
                          rent_secondary_color: patch.secondary_color ?? p.rent_secondary_color,
                          rent_surface_color: patch.surface_color ?? p.rent_surface_color,
                        }))
                      }
                      onResetTheme={() => {
                        const theme = getRentThemeById(form.rent_theme_id || 'aegean_coast');
                        setForm((p) => ({
                          ...p,
                          rent_accent_color: theme.palette.primary,
                          rent_secondary_color: theme.palette.secondary,
                          rent_surface_color: theme.palette.surface,
                        }));
                        toast.success('Χρώματα από το ενεργό θέμα /rent');
                      }}
                    />
                  </PanelCard>
                </form>
              </>
            )}
            {section === 'branding' && (
              <PanelCard
                title="Μάρκα & header /rent"
                description="Ξεχωριστό branding για ενοικιάσεις — live preview, μεγέθη, στυλ logo και επιλογές header."
              >
                <RentBrandDesigner
                  form={form}
                  setForm={setForm}
                  uploading={uploadingLogo}
                  saving={saving}
                  hasCustomLogo={hasCustomRentLogo}
                  onUpload={(e) => handleImageUpload('rent_logo', e)}
                  onClear={() => handleClearAsset('rent_logo')}
                  onSave={async () => {
                    const brandName = String(form.rent_office_name || '').trim();
                    const patch = {
                      rent_office_name: brandName,
                      rent_logo_show_name: form.rent_logo_show_name !== false,
                      rent_logo_height_px: clampLogoHeight(
                        form.rent_logo_height_px ?? 40,
                      ),
                      rent_logo_max_width_px: clampLogoMaxWidth(
                        form.rent_logo_max_width_px ?? 160,
                      ),
                      rent_logo_radius_px: clampLogoRadius(
                        form.rent_logo_radius_px ?? 0,
                      ),
                      rent_logo_padding_px: clampLogoPadding(
                        form.rent_logo_padding_px ?? 0,
                      ),
                      rent_logo_bg_mode: normalizeLogoBgMode(
                        form.rent_logo_bg_mode ?? 'none',
                      ),
                      rent_logo_shadow: form.rent_logo_shadow === true,
                      rent_header_compact: form.rent_header_compact === true,
                    };
                    let logo = String(form.rent_logo_url || '');
                    setSaving(true);
                    try {
                      if (logo.startsWith('data:')) {
                        setUploadingLogo(true);
                        const file = await dataUrlToFile(logo, 'rent-logo');
                        const result = await uploadSiteAsset('rent_logo', file);
                        if (!result?.url) throw new Error('Αποτυχία ανεβάσματος λογοτύπου');
                        logo = result.url;
                        setForm((p) => ({
                          ...p,
                          ...(result.appearance || {}),
                          rent_logo_url: logo,
                        }));
                      }
                      if (logo && !logo.startsWith('data:')) patch.rent_logo_url = logo;
                      const result = await updateSiteAppearance(patch);
                      setForm((p) => ({
                        ...p,
                        ...result.data,
                        ...patch,
                        rent_logo_url: logo || p.rent_logo_url,
                      }));
                      toast.success('Η μάρκα /rent αποθηκεύτηκε', { id: 'rent-brand-save-ok' });
                    } catch (err) {
                      if (err.message === 'AUTH_EXPIRED') {
                        toast.error('Η συνεδρία έληξε — συνδεθείτε ξανά', {
                          id: 'rent-brand-save-err',
                        });
                      } else {
                        toast.error(err.message || 'Αποτυχία αποθήκευσης', {
                          id: 'rent-brand-save-err',
                        });
                      }
                    } finally {
                      setUploadingLogo(false);
                      setSaving(false);
                    }
                  }}
                />
              </PanelCard>
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
                    action={<SaveButton saving={saving} label="Αποθήκευση ενότητας" />}
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
                    action={<SaveButton saving={saving} label="Αποθήκευση ενότητας" />}
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

        {designPage === 'home' && section === 'themes' && (
          <>
            {!String(form.footer_brand_name || '').trim() ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-amber-950">Η αρχική δείχνει ακόμα «Γραφείο»</p>
                  <p className="mt-0.5 text-xs text-amber-900/80">
                    Ορίστε επωνυμία και λογότυπο για να φαίνεται το brand σας στο header.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => selectSection('branding')}
                  className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  Μάρκα
                </button>
              </div>
            ) : null}
            <ThemeGallery
              activeThemeId={form.homepage_theme_id || 'aegean_classic'}
              onPreview={handleThemePreview}
              onApply={handleThemeApply}
              applying={saving}
            />
          </>
        )}

        {/*
          Builder sections (Γενικά / Header / Hero / Slider / Καρτέλες / Footer):
          primary UI is Divi-like inline Builder on the storefront module in the preview iframe.
          Fallback below only shows when Split preview is hidden (editor-only / narrow).
        */}
        {designPage === 'home' && isPageDesignBuilderSection(designPage, section) && (
          <PanelCard
            title={`Builder · ${HOME_SECTIONS.find((s) => s.id === section)?.label || section}`}
            description="Στο Split / Προεπισκόπηση πάτα «Builder» δίπλα στον τίτλο ενότητας (εκδρομές, στόλος, rent — ένα πρότυπο για όλες τις κάρτες). Εδώ εμφανίζεται μόνο όταν δεν υπάρχει ζωντανή προεπισκόπηση."
          >
            <PageDesignBuilderPanel
              section={section}
              form={form}
              setForm={setForm}
              saving={saving}
              onSelectThemes={() => selectSection('themes')}
              onSaveSlider={() =>
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

        {designPage === 'home' && section === 'branding' && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              // Migrate legacy data: URLs (or stuck optimistic previews) via file upload,
              // then save sizing. Never PUT huge data URLs into Postgres.
              const brandName = String(form.footer_brand_name || '').trim();
              const patch = {
                footer_brand_name: brandName,
                // Rent brand (/rent logo + name) is edited under Ενοικιάσεις → Μάρκα.
                logo_height_px: clampLogoHeight(form.logo_height_px),
                logo_max_width_px: clampLogoMaxWidth(form.logo_max_width_px),
                logo_radius_px: clampLogoRadius(form.logo_radius_px),
                logo_padding_px: clampLogoPadding(form.logo_padding_px),
                logo_bg_mode: normalizeLogoBgMode(form.logo_bg_mode),
                logo_shadow: form.logo_shadow === true,
                logo_show_name: form.logo_show_name !== false,
                hero_image_focal: form.hero_image_focal || 'center',
                hero_overlay_opacity:
                  form.hero_overlay_opacity == null ? 100 : Number(form.hero_overlay_opacity),
                hero_image_fit: form.hero_image_fit === 'contain' ? 'contain' : 'cover',
                hero_height_vh: form.hero_height_vh == null ? 88 : Number(form.hero_height_vh),
              };
              let logo = String(form.logo_url || '');
              let hero = String(form.hero_image_url || '');
              setSaving(true);
              try {
                if (logo.startsWith('data:')) {
                  setUploadingLogo(true);
                  const file = await dataUrlToFile(logo, 'logo');
                  const result = await uploadSiteAsset('logo', file);
                  if (!result?.url) throw new Error('Αποτυχία ανεβάσματος λογοτύπου');
                  logo = result.url;
                  setForm((p) => ({ ...p, ...(result.appearance || {}), logo_url: logo }));
                }
                if (hero.startsWith('data:')) {
                  setUploadingHero(true);
                  const file = await dataUrlToFile(hero, 'hero');
                  const result = await uploadSiteAsset('hero', file);
                  if (!result?.url) throw new Error('Αποτυχία ανεβάσματος hero');
                  hero = result.url;
                  setForm((p) => ({ ...p, ...(result.appearance || {}), hero_image_url: hero }));
                }
                if (logo && !logo.startsWith('data:')) patch.logo_url = logo;
                if (hero && !hero.startsWith('data:')) patch.hero_image_url = hero;
                let result;
                try {
                  result = await updateSiteAppearance(patch);
                } catch (firstErr) {
                  // Sizing-only retry — logo file may already be on disk/Postgres.
                  const sizeOnly = {
                    footer_brand_name: patch.footer_brand_name,
                    logo_height_px: patch.logo_height_px,
                    logo_max_width_px: patch.logo_max_width_px,
                    logo_radius_px: patch.logo_radius_px,
                    logo_padding_px: patch.logo_padding_px,
                    logo_bg_mode: patch.logo_bg_mode,
                    logo_shadow: patch.logo_shadow,
                    logo_show_name: patch.logo_show_name,
                    hero_image_focal: patch.hero_image_focal,
                    hero_overlay_opacity: patch.hero_overlay_opacity,
                    hero_image_fit: patch.hero_image_fit,
                    hero_height_vh: patch.hero_height_vh,
                  };
                  if (logo && !logo.startsWith('data:')) sizeOnly.logo_url = logo;
                  result = await updateSiteAppearance(sizeOnly).catch(() => {
                    throw firstErr;
                  });
                }
                setForm((p) => ({ ...p, ...result.data, ...patch, logo_url: logo || p.logo_url }));
                toast.success('Η επωνυμία και το λογότυπο αποθηκεύτηκαν', { id: 'homepage-save-ok' });
              } catch (err) {
                if (err.message === 'AUTH_EXPIRED') {
                  toast.error('Η συνεδρία έληξε — συνδεθείτε ξανά', { id: 'homepage-save-err' });
                } else {
                  toast.error(err.message || 'Αποτυχία αποθήκευσης', { id: 'homepage-save-err' });
                }
              } finally {
                setUploadingLogo(false);
                setUploadingHero(false);
                setSaving(false);
              }
            }}
          >
            <PanelCard
              title="Μάρκα & λογότυπο"
              description="Επωνυμία γραφείου, λογότυπο και hero φωτογραφία — όλα από εδώ."
              action={<SaveButton saving={saving} label="Αποθήκευση ενότητας" />}
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

      </div>
  );

  const builderActive = isPageDesignBuilderSection(designPage, section);

  return (
    <div className="page-design-wizard">
      <PageDesignWizardShell
        designPage={designPage}
        activePageMeta={activePageMeta}
        canSwitchPages={canSwitchPages}
        availablePages={availablePages}
        contractBadge={contractBadge}
        officeMode={officeMode}
        navSections={navSections}
        section={section}
        onSelectPage={selectDesignPage}
        onSelectSection={selectSection}
        previewTo={previewTo}
        previewLabel={previewLabel}
        previewSrc={previewSrc}
        previewPathLabel={previewPathLabel}
        openSiteHref={openSiteHref}
        copyLinkHref={copyLinkHref}
        siteLabel={designPage === 'rent' ? 'Ενοικιάσεις' : 'Ιστοσελίδα γραφείου'}
        brandName={brandName}
        saving={saving}
        dirty={dirty}
        onSave={saveAll}
        previewRefreshToken={previewRefreshToken}
        editorSparse={
          builderActive ||
          (designPage === 'home' && section === 'themes' && isHomepageThemesPlaceholder())
        }
      >
        {sectionContent}
      </PageDesignWizardShell>
    </div>
  );
}
