/** Shared page hero slider helpers for bus homepage + /rent.
 * Inspired by Soliloquy: config options, per-slide meta, schedule, SEO.
 */

export const PAGE_SLIDER_MAX_SLIDES = 8;
export const PAGE_SLIDER_DEFAULT_INTERVAL_SEC = 5;

export const SLIDER_TRANSITIONS = [
  { id: 'fade', label: 'Fade' },
  { id: 'slide', label: 'Slide' },
  { id: 'kenburns', label: 'Ken Burns' },
];

export const SLIDER_CAPTION_POSITIONS = [
  { id: 'bottom', label: 'Κάτω' },
  { id: 'top', label: 'Πάνω' },
  { id: 'left', label: 'Αριστερά' },
  { id: 'right', label: 'Δεξιά' },
  { id: 'center', label: 'Κέντρο' },
];

export const DEFAULT_SLIDER_OPTIONS = {
  transition: 'fade',
  show_arrows: true,
  show_dots: true,
  show_thumbnails: false,
  caption_position: 'bottom',
  loop: true,
  pause_on_hover: true,
  keyboard: true,
  lightbox: false,
  protect: false,
  mobile_hide_captions: false,
};

export const EMPTY_PAGE_SLIDER = {
  enabled: false,
  autoplay: true,
  interval_sec: PAGE_SLIDER_DEFAULT_INTERVAL_SEC,
  options: { ...DEFAULT_SLIDER_OPTIONS },
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
    link_new_tab: Boolean(partial.link_new_tab),
    schedule_start: String(partial.schedule_start || '').trim(),
    schedule_end: String(partial.schedule_end || '').trim(),
  };
}

export function normalizeSliderOptions(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const transition = SLIDER_TRANSITIONS.some((t) => t.id === src.transition)
    ? src.transition
    : DEFAULT_SLIDER_OPTIONS.transition;
  const caption_position = SLIDER_CAPTION_POSITIONS.some((p) => p.id === src.caption_position)
    ? src.caption_position
    : DEFAULT_SLIDER_OPTIONS.caption_position;
  return {
    transition,
    show_arrows: src.show_arrows !== false,
    show_dots: src.show_dots !== false,
    show_thumbnails: Boolean(src.show_thumbnails),
    caption_position,
    loop: src.loop !== false,
    pause_on_hover: src.pause_on_hover !== false,
    keyboard: src.keyboard !== false,
    lightbox: Boolean(src.lightbox),
    protect: Boolean(src.protect),
    mobile_hide_captions: Boolean(src.mobile_hide_captions),
  };
}

export function normalizeSliderSlides(raw, { respectSchedule = false, now = Date.now() } = {}) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => createSliderSlide(item || {}))
    .filter((s) => s.image_url)
    .filter((s) => (respectSchedule ? isSlideScheduledActive(s, now) : true))
    .slice(0, PAGE_SLIDER_MAX_SLIDES);
}

/** Soliloquy-style schedule: empty dates = always on. */
export function isSlideScheduledActive(slide, now = Date.now()) {
  const start = String(slide?.schedule_start || '').trim();
  const end = String(slide?.schedule_end || '').trim();
  if (start) {
    const t = Date.parse(start);
    if (Number.isFinite(t) && now < t) return false;
  }
  if (end) {
    const t = Date.parse(end);
    if (Number.isFinite(t) && now > t) return false;
  }
  return true;
}

export function clampSliderIntervalSec(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return PAGE_SLIDER_DEFAULT_INTERVAL_SEC;
  return Math.max(3, Math.min(20, Math.round(n)));
}

export function readPageSlider(appearance, page = 'home') {
  const prefix = page === 'rent' ? 'rent_slider' : 'home_slider';
  const options = normalizeSliderOptions(appearance?.[`${prefix}_options`]);
  const slides = normalizeSliderSlides(appearance?.[`${prefix}_slides`], {
    respectSchedule: true,
  });
  return {
    enabled: Boolean(appearance?.[`${prefix}_enabled`]) && slides.length > 0,
    autoplay: appearance?.[`${prefix}_autoplay`] !== false,
    interval_sec: clampSliderIntervalSec(appearance?.[`${prefix}_interval_sec`]),
    options,
    slides,
  };
}

export function pageSliderPatch(page, slider) {
  const prefix = page === 'rent' ? 'rent_slider' : 'home_slider';
  return {
    [`${prefix}_enabled`]: Boolean(slider.enabled),
    [`${prefix}_autoplay`]: slider.autoplay !== false,
    [`${prefix}_interval_sec`]: clampSliderIntervalSec(slider.interval_sec),
    [`${prefix}_options`]: normalizeSliderOptions(slider.options),
    [`${prefix}_slides`]: normalizeSliderSlides(slider.slides, { respectSchedule: false }),
  };
}
