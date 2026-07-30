/** Shared page hero slider helpers for bus homepage + /rent. */

export const PAGE_SLIDER_MAX_SLIDES = 8;
export const PAGE_SLIDER_DEFAULT_INTERVAL_SEC = 5;

export const EMPTY_PAGE_SLIDER = {
  enabled: false,
  autoplay: true,
  interval_sec: PAGE_SLIDER_DEFAULT_INTERVAL_SEC,
  slides: [],
};

export function createSliderSlide(partial = {}) {
  const id =
    String(partial.id || '').trim() ||
    `slide_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    image_url: String(partial.image_url || '').trim(),
    title: String(partial.title || '').trim(),
    subtitle: String(partial.subtitle || '').trim(),
    cta_label: String(partial.cta_label || '').trim(),
    cta_href: String(partial.cta_href || '').trim(),
    alt: String(partial.alt || '').trim(),
  };
}

export function normalizeSliderSlides(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => createSliderSlide(item || {}))
    .filter((s) => s.image_url)
    .slice(0, PAGE_SLIDER_MAX_SLIDES);
}

export function clampSliderIntervalSec(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return PAGE_SLIDER_DEFAULT_INTERVAL_SEC;
  return Math.max(3, Math.min(20, Math.round(n)));
}

export function readPageSlider(appearance, page = 'home') {
  const prefix = page === 'rent' ? 'rent_slider' : 'home_slider';
  const slides = normalizeSliderSlides(appearance?.[`${prefix}_slides`]);
  return {
    enabled: Boolean(appearance?.[`${prefix}_enabled`]) && slides.length > 0,
    autoplay: appearance?.[`${prefix}_autoplay`] !== false,
    interval_sec: clampSliderIntervalSec(appearance?.[`${prefix}_interval_sec`]),
    slides,
  };
}

export function pageSliderPatch(page, slider) {
  const prefix = page === 'rent' ? 'rent_slider' : 'home_slider';
  return {
    [`${prefix}_enabled`]: Boolean(slider.enabled),
    [`${prefix}_autoplay`]: slider.autoplay !== false,
    [`${prefix}_interval_sec`]: clampSliderIntervalSec(slider.interval_sec),
    [`${prefix}_slides`]: normalizeSliderSlides(slider.slides),
  };
}
