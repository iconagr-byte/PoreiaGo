/**
 * Page Studio hero gallery — primary + extra slides for carousel.
 * The branded Achillio bus path is a real photo when set as hero_image_url;
 * only synthetic role=fallback placeholders are excluded on write.
 */

import {
  PAGE_SLIDER_MAX_SLIDES,
  createSliderSlide,
  normalizeSliderSlides,
  pageSliderPatch,
} from './pageSlider.js';

export const HERO_GALLERY_FALLBACK = '/images/hero-bus-achillio.png';
export const HERO_GALLERY_MAX = PAGE_SLIDER_MAX_SLIDES;

export function resolveGalleryUrl(url, resolveSiteAssetUrl) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (typeof resolveSiteAssetUrl === 'function') {
    return resolveSiteAssetUrl(raw) || raw;
  }
  return raw;
}

/** Gallery = primary hero + extra slider slides (deduped). */
export function readHeroGallery(form, { resolveSiteAssetUrl, fallbackUrl = HERO_GALLERY_FALLBACK } = {}) {
  const primaryRaw = String(form?.hero_image_url || '').trim();
  const slides = normalizeSliderSlides(form?.home_slider_slides, { respectSchedule: false });
  const items = [];
  const seen = new Set();

  const push = (id, url, role) => {
    const raw = String(url || '').trim();
    if (!raw) return;
    const key = resolveGalleryUrl(raw, resolveSiteAssetUrl);
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ id, url: raw, role });
  };

  if (primaryRaw) {
    push('hero-primary', primaryRaw, 'primary');
  }

  for (const slide of slides) {
    push(slide.id, slide.image_url, 'extra');
  }

  if (!items.length) {
    items.push({ id: 'hero-fallback', url: fallbackUrl, role: 'fallback' });
  }

  return items.slice(0, HERO_GALLERY_MAX);
}

/**
 * Persist gallery → hero_image_url + home_slider_*.
 * Keep every non-fallback photo — including the Achillio bus asset URL —
 * so adding a 2nd/3rd image never replaces the current primary.
 */
export function writeHeroGalleryPatch(
  photos,
  { carousel, autoplay, intervalSec, options } = {},
) {
  const list = (photos || []).filter((p) => p && p.role !== 'fallback' && String(p.url || '').trim());
  const primary = list[0]?.url || '';
  const extras = list.slice(1).map((p) =>
    createSliderSlide({
      id: p.role === 'extra' && !String(p.id).startsWith('hero-') ? p.id : undefined,
      image_url: p.url,
    }),
  );

  // When carousel is on, include primary in slides so the live hero rotates all photos.
  const slidesForCarousel = list.map((p) =>
    createSliderSlide({
      id: p.role === 'extra' && !String(p.id).startsWith('hero-') ? p.id : undefined,
      image_url: p.url,
    }),
  );

  const enableCarousel = Boolean(carousel) && list.length >= 2;

  return {
    hero_image_url: primary,
    ...pageSliderPatch('home', {
      enabled: enableCarousel,
      autoplay: autoplay !== false,
      interval_sec: intervalSec,
      options,
      slides: enableCarousel ? slidesForCarousel : extras,
    }),
  };
}
