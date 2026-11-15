import { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import RentBrandMark from '../rental/RentBrandMark.jsx';
import {
  clampLogoHeight,
  clampLogoMaxWidth,
  clampLogoPadding,
  clampLogoRadius,
  normalizeLogoBgMode,
} from '../../lib/branding/officeBrand.js';
import { resolveRentAppBranding } from '../../lib/rental/rentAppBranding.js';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';

const SIZE_PRESETS = [
  { id: 's', label: 'S', height: 40, maxWidth: 140 },
  { id: 'm', label: 'M', height: 52, maxWidth: 180 },
  { id: 'l', label: 'L', height: 64, maxWidth: 240 },
  { id: 'xl', label: 'XL', height: 80, maxWidth: 300 },
];

const RADIUS_PRESETS = [
  { label: 'Ορθό', value: 0 },
  { label: 'Ήπιο', value: 8 },
  { label: 'Στρογγυλό', value: 16 },
  { label: 'Χάπι', value: 48 },
];

const BG_OPTIONS = [
  { id: 'none', label: 'Κανένα', swatch: 'transparent', border: true },
  { id: 'white', label: 'Λευκό', swatch: '#ffffff', border: true },
  { id: 'soft', label: 'Απαλό', swatch: 'rgba(15, 23, 42, 0.08)', border: false },
  { id: 'dark', label: 'Σκούρο', swatch: 'rgba(15, 23, 42, 0.92)', border: false },
];

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif)$/i;

function isLogoImageFile(file) {
  if (!file) return false;
  const type = String(file.type || '').toLowerCase();
  if (type.startsWith('image/') && !type.includes('heic') && !type.includes('heif')) {
    return true;
  }
  return IMAGE_EXT_RE.test(String(file.name || ''));
}

function matchSizePreset(height, maxWidth) {
  return SIZE_PRESETS.find((p) => p.height === height && p.maxWidth === maxWidth)?.id || null;
}

/**
 * Apple-clean rent brand studio — live header preview + logo/name controls.
 * Stored on site_appearance (rent_* fields), independent from buses branding.
 */
export default function RentBrandDesigner({
  form,
  setForm,
  uploading = false,
  saving = false,
  hasCustomLogo = false,
  onUpload,
  onClear,
  onSave,
}) {
  const fileRef = useRef(null);
  const [previewTone, setPreviewTone] = useState('light');
  const [dragOver, setDragOver] = useState(false);

  const height = clampLogoHeight(form.rent_logo_height_px ?? form.logo_height_px ?? 64);
  const maxWidth = clampLogoMaxWidth(form.rent_logo_max_width_px ?? 240);
  const radius = clampLogoRadius(form.rent_logo_radius_px ?? 0);
  const padding = clampLogoPadding(form.rent_logo_padding_px ?? 0);
  const bgMode = normalizeLogoBgMode(form.rent_logo_bg_mode ?? 'none');
  const shadowOn = form.rent_logo_shadow === true;
  const compact = form.rent_header_compact === true;
  const showName = form.rent_logo_show_name !== false;
  const sizePreset = matchSizePreset(height, maxWidth);

  const preview = useMemo(
    () =>
      resolveRentAppBranding({
        ...form,
        rent_logo_height_px: height,
        rent_logo_max_width_px: maxWidth,
        rent_logo_radius_px: radius,
        rent_logo_padding_px: padding,
        rent_logo_bg_mode: bgMode,
        rent_logo_shadow: shadowOn,
        rent_logo_show_name: showName,
        rent_header_compact: compact,
      }),
    [form, height, maxWidth, radius, padding, bgMode, shadowOn, showName, compact],
  );

  const logoSrc = preview.logoUrl ? resolveSiteAssetUrl(preview.logoUrl) : '';
  const usingOfficeFallback = !hasCustomLogo && Boolean(form.logo_url);

  const pickFile = () => {
    if (uploading || saving) return;
    fileRef.current?.click();
  };

  const ingestFile = (file) => {
    if (!file) return;
    const name = String(file.name || '').toLowerCase();
    if (name.endsWith('.heic') || name.endsWith('.heif') || String(file.type || '').includes('heic')) {
      toast.error('HEIC δεν υποστηρίζεται — αποθηκεύστε ως JPG / PNG');
      return;
    }
    if (!isLogoImageFile(file)) {
      toast.error('Μόνο εικόνες (PNG / JPG / WebP)');
      return;
    }
    onUpload?.({ target: { files: [file], value: '' } });
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (uploading || saving) return;
    ingestFile(e.dataTransfer?.files?.[0]);
  };

  const copyOfficeLogo = () => {
    const office = String(form.logo_url || '').trim();
    if (!office || office.startsWith('data:')) {
      toast.error('Δεν υπάρχει λογότυπο γραφείου για αντιγραφή');
      return;
    }
    setForm((p) => ({
      ...p,
      rent_logo_url: office,
      rent_logo_show_name: p.rent_logo_show_name ?? p.logo_show_name !== false,
    }));
    toast.success('Αντιγράφηκε το logo γραφείου — πατήστε Αποθήκευση');
  };

  const applySizePreset = (preset) => {
    setForm((p) => ({
      ...p,
      rent_logo_height_px: preset.height,
      rent_logo_max_width_px: preset.maxWidth,
    }));
  };

  const setBgMode = (id) => {
    setForm((p) => {
      const next = { ...p, rent_logo_bg_mode: id };
      // Background needs a little padding to read — auto-bump from 0.
      if (id !== 'none' && clampLogoPadding(p.rent_logo_padding_px ?? 0) === 0) {
        next.rent_logo_padding_px = 8;
      }
      return next;
    });
  };

  return (
    <div className="rent-brand-studio space-y-5">
      {/* Sticky live header preview */}
      <section className="sticky top-2 z-20 overflow-hidden rounded-[22px] border border-black/[0.06] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.04] bg-slate-50/90 px-5 py-3 backdrop-blur-md">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700/80">
              Live preview
            </p>
            <p className="text-sm font-bold text-slate-900">
              Header /rent · {height}×{maxWidth}px
            </p>
          </div>
          <div className="inline-flex rounded-full bg-slate-200/70 p-0.5 text-[11px] font-bold">
            {[
              { id: 'light', label: 'Φωτεινό' },
              { id: 'dark', label: 'Σκούρο' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPreviewTone(t.id)}
                className={`rounded-full px-3 py-1.5 transition ${
                  previewTone === t.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className={`relative px-4 py-5 sm:px-6 ${
            previewTone === 'dark'
              ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950'
              : 'bg-gradient-to-br from-slate-100 via-white to-teal-50/60'
          }`}
        >
          <div
            className={`mx-auto max-w-3xl overflow-hidden rounded-2xl border backdrop-blur-xl ${
              previewTone === 'dark'
                ? 'border-white/10 bg-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.35)]'
                : 'border-white/70 bg-white/80 shadow-[0_12px_40px_rgba(15,23,42,0.08)]'
            }`}
          >
            <div
              className={`flex items-center justify-between gap-3 px-3.5 ${
                compact ? 'py-2' : 'py-3'
              }`}
            >
              <div className="min-w-0">
                <RentBrandMark
                  label={preview.brandLabel}
                  logoUrl={preview.logoUrl}
                  showName={preview.showName}
                  compact={compact}
                  variant={previewTone === 'dark' ? 'onDark' : 'default'}
                  logoHeightPx={preview.logoHeightPx}
                  logoMaxWidthPx={preview.logoMaxWidthPx}
                  logoRadiusPx={preview.logoRadiusPx}
                  logoPaddingPx={preview.logoPaddingPx}
                  logoBgMode={preview.logoBgMode}
                  logoShadow={preview.logoShadow}
                />
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <span
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                    previewTone === 'dark'
                      ? 'bg-white/10 text-white/90'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  ΕΛ
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                    previewTone === 'dark'
                      ? 'bg-teal-400/20 text-teal-100'
                      : 'bg-teal-600 text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">wallet</span>
                  Wallet
                </span>
              </div>
            </div>
          </div>
          <p
            className={`mt-3 text-center text-[11px] font-medium ${
              previewTone === 'dark' ? 'text-white/45' : 'text-slate-400'
            }`}
          >
            {usingOfficeFallback
              ? 'Προεπισκόπηση με logo γραφείου (fallback) — ανεβάστε ξεχωριστό για /rent'
              : hasCustomLogo
                ? 'Οι αλλαγές εμφανίζονται αμέσως — πατήστε Αποθήκευση για το live /rent'
                : 'Χωρίς εικόνα — εμφανίζεται το teal badge + όνομα'}
          </p>
        </div>
      </section>

      {/* Name */}
      <section className="rounded-[22px] border border-black/[0.06] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h5 className="font-bold text-slate-900">Όνομα μάρκας</h5>
            <p className="mt-0.5 text-xs text-slate-500">
              Στο header δίπλα στο λογότυπο · π.χ. «Poreia Rent»
            </p>
          </div>
          <a
            href="/rent"
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-[11px] font-bold text-teal-800 hover:bg-teal-100"
          >
            Άνοιγμα /rent
            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
          </a>
        </div>
        <input
          className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-[15px] font-semibold text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100"
          placeholder="π.χ. Achillio Rent"
          value={form.rent_office_name || ''}
          onChange={(e) => setForm((p) => ({ ...p, rent_office_name: e.target.value }))}
          maxLength={80}
          autoComplete="organization"
        />
      </section>

      {/* Logo upload + size */}
      <section className="overflow-hidden rounded-[22px] border border-black/[0.06] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
        <div className="border-b border-black/[0.04] bg-slate-50/80 px-5 py-4">
          <h5 className="font-bold text-slate-900">Λογότυπο /rent</h5>
          <p className="mt-0.5 text-xs text-slate-500">
            PNG με διαφάνεια προτιμότερο · JPG / WebP επίσης
          </p>
        </div>
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1.15fr]">
          <button
            type="button"
            onClick={pickFile}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            disabled={uploading || saving}
            className={`relative flex min-h-[10rem] flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-dashed px-4 py-6 text-center transition ${
              dragOver
                ? 'border-teal-400 bg-teal-50'
                : logoSrc
                  ? 'border-teal-200/80 bg-gradient-to-b from-white to-teal-50/40'
                  : 'border-slate-200 bg-slate-50/80 hover:border-teal-300 hover:bg-teal-50/40'
            }`}
          >
            {logoSrc ? (
              <img
                src={logoSrc}
                alt="Λογότυπο rent"
                className="max-w-[220px] object-contain"
                style={{
                  height: `${Math.min(Math.max(height, 36), 88)}px`,
                  borderRadius: `${Math.min(radius, 16)}px`,
                }}
              />
            ) : (
              <span className="material-symbols-outlined text-[40px] text-slate-300">
                add_photo_alternate
              </span>
            )}
            <span className="text-sm font-bold text-slate-800">
              {uploading ? 'Ανέβασμα…' : 'Σύρετε ή πατήστε για ανέβασμα'}
            </span>
            <span className="text-[11px] text-slate-500">Μέγ. 4 MB · PNG / JPG / WebP</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
              className="hidden"
              disabled={uploading || saving}
              onChange={(e) => {
                ingestFile(e.target?.files?.[0]);
                e.target.value = '';
              }}
            />
          </button>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={pickFile}
                disabled={uploading || saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">upload</span>
                Ανέβασμα
              </button>
              {hasCustomLogo ? (
                <button
                  type="button"
                  onClick={onClear}
                  disabled={uploading || saving}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Καθαρισμός
                </button>
              ) : null}
              {form.logo_url ? (
                <button
                  type="button"
                  onClick={copyOfficeLogo}
                  disabled={uploading || saving}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-sm font-bold text-teal-900 hover:bg-teal-100"
                  title="Αντιγραφή του κοινού logo γραφείου ως rent logo"
                >
                  <span className="material-symbols-outlined text-[18px]">content_copy</span>
                  Από γραφείο
                </button>
              ) : null}
            </div>

            <div>
              <p className="mb-2 text-xs font-bold text-slate-500">Γρήγορο μέγεθος</p>
              <div className="flex flex-wrap gap-1.5">
                {SIZE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applySizePreset(preset)}
                    className={`min-w-[3rem] rounded-xl border px-3 py-2 text-sm font-bold transition ${
                      sizePreset === preset.id
                        ? 'border-teal-700 bg-teal-700 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300'
                    }`}
                    title={`${preset.height}×${preset.maxWidth}px`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-500">
                <span>Ύψος λογοτύπου</span>
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 tabular-nums text-slate-800">
                  {height}px
                </span>
              </div>
              <input
                type="range"
                min={24}
                max={96}
                step={1}
                value={height}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    rent_logo_height_px: clampLogoHeight(e.target.value),
                  }))
                }
                className="w-full accent-teal-700"
                aria-label="Ύψος λογοτύπου"
              />
              <div className="mt-1 flex justify-between text-[10px] font-medium text-slate-400">
                <span>24</span>
                <span>96</span>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-500">
                <span>Μέγ. πλάτος</span>
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 tabular-nums text-slate-800">
                  {maxWidth}px
                </span>
              </div>
              <input
                type="range"
                min={80}
                max={360}
                step={4}
                value={maxWidth}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    rent_logo_max_width_px: clampLogoMaxWidth(e.target.value),
                  }))
                }
                className="w-full accent-teal-700"
                aria-label="Μέγιστο πλάτος λογοτύπου"
              />
              <div className="mt-1 flex justify-between text-[10px] font-medium text-slate-400">
                <span>80</span>
                <span>360</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logo design */}
      <section className="rounded-[22px] border border-black/[0.06] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
        <h5 className="font-bold text-slate-900">Σχεδιασμός λογοτύπου</h5>
        <p className="mt-0.5 mb-4 text-xs text-slate-500">
          Στρογγύλεμα, φόντο και σκιά — εφαρμόζονται στο header /rent
        </p>

        <div className="space-y-5">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Στρογγύλεμα</span>
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 tabular-nums text-slate-800">
                {radius}px
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={48}
              step={1}
              value={radius}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  rent_logo_radius_px: clampLogoRadius(e.target.value),
                }))
              }
              className="w-full accent-teal-700"
              aria-label="Στρογγύλεμα λογοτύπου"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {RADIUS_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() =>
                    setForm((p) => ({ ...p, rent_logo_radius_px: preset.value }))
                  }
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
                    radius === preset.value
                      ? 'border-teal-700 bg-teal-700 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Εσωτερικό κενό</span>
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 tabular-nums text-slate-800">
                {padding}px
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={24}
              step={1}
              value={padding}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  rent_logo_padding_px: clampLogoPadding(e.target.value),
                }))
              }
              className="w-full accent-teal-700"
              aria-label="Εσωτερικό κενό λογοτύπου"
            />
            <p className="mt-1.5 text-[11px] text-slate-400">
              Χρήσιμο μαζί με φόντο — δίνει «πλαίσιο» γύρω από το λογότυπο
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold text-slate-500">Φόντο</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {BG_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setBgMode(opt.id)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-center transition ${
                    bgMode === opt.id
                      ? 'border-teal-700 bg-teal-50 shadow-sm ring-2 ring-teal-700/20'
                      : 'border-slate-200 bg-white hover:border-teal-300'
                  }`}
                >
                  <span
                    className="h-8 w-8 rounded-xl shadow-inner"
                    style={{
                      background: opt.swatch,
                      boxShadow: opt.border
                        ? 'inset 0 0 0 1px rgba(15,23,42,0.12)'
                        : undefined,
                    }}
                    aria-hidden
                  />
                  <span
                    className={`text-[11px] font-bold ${
                      bgMode === opt.id ? 'text-teal-900' : 'text-slate-600'
                    }`}
                  >
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={shadowOn}
            onClick={() =>
              setForm((p) => ({ ...p, rent_logo_shadow: !p.rent_logo_shadow }))
            }
            className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
              shadowOn
                ? 'border-teal-300 bg-teal-50'
                : 'border-black/[0.06] bg-slate-50/80 hover:bg-slate-50'
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">Ήπια σκιά</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Δίνει βάθος στο λογότυπο</p>
            </div>
            <span
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                shadowOn ? 'bg-teal-700' : 'bg-slate-300'
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
      </section>

      {/* Header options */}
      <section className="rounded-[22px] border border-black/[0.06] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
        <h5 className="font-bold text-slate-900">Header επιλογές</h5>
        <p className="mt-0.5 mb-4 text-xs text-slate-500">
          Επιπλέον ρυθμίσεις εμφάνισης στο πάνω μέρος της /rent
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, rent_logo_show_name: true }))}
            className={`rounded-2xl border px-4 py-3.5 text-left transition ${
              showName
                ? 'border-teal-300 bg-teal-50 shadow-sm'
                : 'border-black/[0.06] bg-slate-50/80 hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined text-[22px] text-teal-700">badge</span>
            <span className="mt-2 block text-sm font-bold text-slate-900">Όνομα δίπλα στο logo</span>
            <span className="mt-0.5 block text-[11px] text-slate-500">
              Wordmark δίπλα στην εικόνα
            </span>
          </button>
          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, rent_logo_show_name: false }))}
            className={`rounded-2xl border px-4 py-3.5 text-left transition ${
              !showName
                ? 'border-teal-300 bg-teal-50 shadow-sm'
                : 'border-black/[0.06] bg-slate-50/80 hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined text-[22px] text-teal-700">hide_image</span>
            <span className="mt-2 block text-sm font-bold text-slate-900">Μόνο λογότυπο</span>
            <span className="mt-0.5 block text-[11px] text-slate-500">
              Κρύβει το κείμενο δίπλα στο logo
            </span>
          </button>
          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, rent_header_compact: false }))}
            className={`rounded-2xl border px-4 py-3.5 text-left transition ${
              !compact
                ? 'border-teal-300 bg-teal-50 shadow-sm'
                : 'border-black/[0.06] bg-slate-50/80 hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined text-[22px] text-teal-700">expand</span>
            <span className="mt-2 block text-sm font-bold text-slate-900">Άνετο header</span>
            <span className="mt-0.5 block text-[11px] text-slate-500">Περισσότερο ύψος / padding</span>
          </button>
          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, rent_header_compact: true }))}
            className={`rounded-2xl border px-4 py-3.5 text-left transition ${
              compact
                ? 'border-teal-300 bg-teal-50 shadow-sm'
                : 'border-black/[0.06] bg-slate-50/80 hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined text-[22px] text-teal-700">compress</span>
            <span className="mt-2 block text-sm font-bold text-slate-900">Compact header</span>
            <span className="mt-0.5 block text-[11px] text-slate-500">
              Πιο χαμηλό top bar σε mobile
            </span>
          </button>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Οι αλλαγές ισχύουν μόνο στο <strong className="font-semibold text-slate-700">/rent</strong>
          — όχι στις εκδρομές.
        </p>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || uploading}
          className="inline-flex items-center gap-2 rounded-2xl bg-teal-700 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-teal-800 disabled:opacity-50"
        >
          {saving ? (
            <span className="material-symbols-outlined animate-spin text-[18px]">
              progress_activity
            </span>
          ) : (
            <span className="material-symbols-outlined text-[18px]">save</span>
          )}
          Αποθήκευση μάρκας
        </button>
      </div>
    </div>
  );
}
