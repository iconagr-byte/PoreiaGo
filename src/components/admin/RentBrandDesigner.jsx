import { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import RentBrandMark from '../rental/RentBrandMark.jsx';
import {
  clampLogoHeight,
  clampLogoMaxWidth,
} from '../../lib/branding/officeBrand.js';
import { resolveRentAppBranding } from '../../lib/rental/rentAppBranding.js';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';

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

  const height = clampLogoHeight(form.rent_logo_height_px ?? form.logo_height_px ?? 40);
  const maxWidth = clampLogoMaxWidth(form.rent_logo_max_width_px ?? 160);
  const compact = form.rent_header_compact === true;
  const showName = form.rent_logo_show_name !== false;

  const preview = useMemo(
    () =>
      resolveRentAppBranding({
        ...form,
        rent_logo_height_px: height,
        rent_logo_max_width_px: maxWidth,
        rent_logo_show_name: showName,
        rent_header_compact: compact,
      }),
    [form, height, maxWidth, showName, compact],
  );

  const logoSrc = preview.logoUrl ? resolveSiteAssetUrl(preview.logoUrl) : '';
  const usingOfficeFallback = !hasCustomLogo && Boolean(form.logo_url);

  const pickFile = () => {
    if (uploading || saving) return;
    fileRef.current?.click();
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (uploading || saving) return;
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
      toast.error('Μόνο εικόνες (PNG / JPG / WebP)');
      return;
    }
    onUpload?.({ target: { files: [file], value: '' } });
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

  return (
    <div className="rent-brand-studio space-y-5">
      {/* Live header preview */}
      <section className="overflow-hidden rounded-[22px] border border-black/[0.06] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.04] bg-slate-50/80 px-5 py-3.5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700/80">
              Live preview
            </p>
            <p className="text-sm font-bold text-slate-900">Header /rent</p>
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
              <div
                className="min-w-0"
                style={{
                  ['--rent-logo-h']: `${height}px`,
                  ['--rent-logo-max-w']: `${maxWidth}px`,
                }}
              >
                <RentBrandMark
                  label={preview.brandLabel}
                  logoUrl={preview.logoUrl}
                  showName={preview.showName}
                  compact={compact}
                  variant={previewTone === 'dark' ? 'onDark' : 'default'}
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
                ? 'Προσαρμοσμένο λογότυπο /rent'
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

      {/* Logo upload */}
      <section className="overflow-hidden rounded-[22px] border border-black/[0.06] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
        <div className="border-b border-black/[0.04] bg-slate-50/80 px-5 py-4">
          <h5 className="font-bold text-slate-900">Λογότυπο /rent</h5>
          <p className="mt-0.5 text-xs text-slate-500">
            PNG με διαφάνεια προτιμότερο · JPG / WebP επίσης
          </p>
        </div>
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1.1fr]">
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
            className={`relative flex min-h-[9.5rem] flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-dashed px-4 py-6 text-center transition ${
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
                className="max-h-16 max-w-[180px] object-contain"
                style={{ height: `${Math.min(height, 64)}px` }}
              />
            ) : (
              <span className="material-symbols-outlined text-[40px] text-slate-300">
                add_photo_alternate
              </span>
            )}
            <span className="text-sm font-bold text-slate-800">
              {uploading ? 'Ανέβασμα…' : 'Σύρετε ή πατήστε για ανέβασμα'}
            </span>
            <span className="text-[11px] text-slate-500">Μέγ. 4 MB</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              disabled={uploading || saving}
              onChange={(e) => onUpload?.(e)}
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
                  title="Αντιγραφή του κοινόυ logo γραφείου ως rent logo"
                >
                  <span className="material-symbols-outlined text-[18px]">content_copy</span>
                  Από γραφείο
                </button>
              ) : null}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-500">
                <span>Ύψος λογοτύπου</span>
                <span className="tabular-nums text-slate-800">{height}px</span>
              </div>
              <input
                type="range"
                min={24}
                max={72}
                step={1}
                value={height}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    rent_logo_height_px: clampLogoHeight(e.target.value),
                  }))
                }
                className="w-full accent-teal-700"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-500">
                <span>Μέγ. πλάτος</span>
                <span className="tabular-nums text-slate-800">{maxWidth}px</span>
              </div>
              <input
                type="range"
                min={80}
                max={280}
                step={4}
                value={maxWidth}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    rent_logo_max_width_px: clampLogoMaxWidth(e.target.value),
                  }))
                }
                className="w-full accent-teal-700"
              />
            </div>
          </div>
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
            <span className="material-symbols-outlined text-[22px] text-teal-700">
              expand
            </span>
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
