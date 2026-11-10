import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { TRIP_COVER_ACCEPT, fileToTripCoverDataUrl } from '../../../lib/trips/tripImage.js';
import { HERO_FOCAL_OPTIONS, heroFocalCss } from '../../../lib/homepage/heroFocal.js';
import {
  HERO_FIT_OPTIONS,
  HERO_PHOTO_DEFAULTS,
  clampHeroHeightVh,
  clampHeroOverlayOpacity,
  normalizeHeroImageFit,
} from '../../../lib/homepage/heroPhoto.js';
import {
  DEFAULT_SITE_APPEARANCE,
  clearSiteAsset,
  resolveSiteAssetUrl,
  uploadSiteAsset,
} from '../../../services/siteAppearanceApi.js';

/**
 * Compact hero photo controls for Page Design Builder (Φωτογραφία tab).
 * Uploads via existing site appearance APIs; draft sync happens through setForm.
 */
export default function CompactHeroPhoto({ form, setForm }) {
  const [uploading, setUploading] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const fileRef = useRef(null);

  const previewUrl =
    resolveSiteAssetUrl(form.hero_image_url) || '/images/hero-bus-achillio.png';
  const hasCustom =
    Boolean(form.hero_image_url) &&
    form.hero_image_url !== DEFAULT_SITE_APPEARANCE.hero_image_url;
  const focal = form.hero_image_focal || 'center';
  const overlay = clampHeroOverlayOpacity(
    form.hero_overlay_opacity ?? HERO_PHOTO_DEFAULTS.hero_overlay_opacity,
  );
  const fit = normalizeHeroImageFit(form.hero_image_fit);
  const heightVh = clampHeroHeightVh(
    form.hero_height_vh ?? HERO_PHOTO_DEFAULTS.hero_height_vh,
  );

  const patch = (next) => setForm((p) => ({ ...p, ...next }));

  const uploadFile = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      toast.error('Μόνο αρχεία εικόνας (JPG, PNG, WebP)');
      return;
    }
    const previousUrl = form.hero_image_url;
    setUploading(true);
    try {
      try {
        const preview = await fileToTripCoverDataUrl(file);
        patch({ hero_image_url: preview });
      } catch {
        /* preview optional */
      }
      const result = await uploadSiteAsset('hero', file);
      const url = result?.url;
      if (!url) throw new Error('Δεν επιστράφηκε URL από τον server');
      setForm((p) => ({
        ...p,
        ...(result?.appearance || {}),
        hero_image_url: url,
      }));
      toast.success('Η φωτογραφία hero ενημερώθηκε');
    } catch (err) {
      setForm((p) => ({ ...p, hero_image_url: previousUrl }));
      if (err.message === 'AUTH_EXPIRED') {
        toast.error('Η συνεδρία έληξε — συνδεθείτε ξανά');
        return;
      }
      const msg = String(err.message || '');
      if (/heic|heif|decode|μη έγκυρη|could not decode|invalid image|μόνο αρχεία/i.test(msg)) {
        toast.error('Μη υποστηριζόμενη εικόνα — δοκιμάστε JPG ή PNG');
        return;
      }
      toast.error(msg || 'Αποτυχία ανεβάσματος');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onFileChange = (e) => {
    const file = e?.target?.files?.[0];
    if (e?.target) e.target.value = '';
    uploadFile(file);
  };

  const onClear = async () => {
    setUploading(true);
    try {
      const result = await clearSiteAsset('hero');
      setForm((p) => ({ ...p, ...result.appearance }));
      toast.success('Επαναφορά προεπιλογής');
    } catch (err) {
      if (err.message === 'AUTH_EXPIRED') return;
      toast.error(err.message || 'Αποτυχία');
    } finally {
      setUploading(false);
    }
  };

  const applyUrl = () => {
    const url = String(urlDraft || '').trim();
    if (!url) {
      toast.error('Βάλε URL εικόνας');
      return;
    }
    if (!/^https?:\/\//i.test(url) && !url.startsWith('/') && !url.startsWith('data:')) {
      toast.error('Χρησιμοποίησε http(s) ή /path');
      return;
    }
    patch({ hero_image_url: url });
    setUrlDraft('');
    toast.success('Το URL ορίστηκε — αποθηκεύστε από το στούντιο σχεδίασης');
  };

  return (
    <div className="pdw-builder__stack">
      <div className="pdw-hero-photo__preview">
        <div
          className="pdw-hero-photo__media"
          style={{
            backgroundImage: `url('${previewUrl}')`,
            backgroundPosition: heroFocalCss(focal),
            backgroundSize: fit,
          }}
          aria-hidden
        />
        <div
          className="pdw-hero-photo__shade"
          style={{ opacity: overlay / 100 }}
          aria-hidden
        />
        {uploading ? (
          <div className="pdw-hero-photo__busy">
            <span className="material-symbols-outlined animate-spin text-[16px]">
              progress_activity
            </span>
            Ανέβασμα…
          </div>
        ) : null}
      </div>

      <div className="pdw-hero-photo__actions">
        <label className="pdw-hero-photo__upload">
          <span className="material-symbols-outlined text-[16px]">upload</span>
          {hasCustom ? 'Αλλαγή' : 'Ανέβασμα'}
          <input
            ref={fileRef}
            type="file"
            accept={TRIP_COVER_ACCEPT}
            className="hidden"
            disabled={uploading}
            onChange={onFileChange}
          />
        </label>
        {hasCustom ? (
          <button
            type="button"
            className="pdw-builder__link"
            disabled={uploading}
            onClick={onClear}
          >
            Επαναφορά
          </button>
        ) : null}
      </div>

      <div className="pdw-hero-photo__url-row">
        <input
          className="pdw-builder__input"
          placeholder="https://… ή /images/…"
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              applyUrl();
            }
          }}
        />
        <button type="button" className="pdw-hero-photo__url-btn" onClick={applyUrl}>
          URL
        </button>
      </div>

      <div>
        <p className="pdw-builder__subhead">Σημείο εστίασης</p>
        <div className="pdw-hero-photo__chips">
          {HERO_FOCAL_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`pdw-hero-photo__chip${focal === opt.id ? ' is-active' : ''}`}
              onClick={() => patch({ hero_image_focal: opt.id })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="pdw-builder__subhead">Προσαρμογή (fit)</p>
        <div className="pdw-hero-photo__chips">
          {HERO_FIT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              title={opt.hint}
              className={`pdw-hero-photo__chip${fit === opt.id ? ' is-active' : ''}`}
              onClick={() => patch({ hero_image_fit: opt.id })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <label className="pdw-builder__field">
        <span className="pdw-builder__field-label">
          Σκοτεινότητα overlay
          <span className="text-slate-400 font-semibold tabular-nums">{overlay}%</span>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          className="pdw-hero-photo__range"
          value={overlay}
          onChange={(e) =>
            patch({ hero_overlay_opacity: clampHeroOverlayOpacity(e.target.value) })
          }
        />
      </label>

      <label className="pdw-builder__field">
        <span className="pdw-builder__field-label">
          Ύψος hero
          <span className="text-slate-400 font-semibold tabular-nums">{heightVh}vh</span>
        </span>
        <input
          type="range"
          min={50}
          max={100}
          step={2}
          className="pdw-hero-photo__range"
          value={heightVh}
          onChange={(e) => patch({ hero_height_vh: clampHeroHeightVh(e.target.value) })}
        />
      </label>
    </div>
  );
}
