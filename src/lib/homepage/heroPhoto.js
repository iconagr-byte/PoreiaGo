/** Shared hero background photo params (Builder + storefront). */

export const HERO_FIT_OPTIONS = [
  { id: 'cover', label: 'Κάλυψη', hint: 'Γεμίζει το πλαίσιο (κόβει άκρες)' },
  { id: 'contain', label: 'Ολόκληρη', hint: 'Φαίνεται όλη η εικόνα' },
];

export const HERO_PHOTO_DEFAULTS = {
  hero_overlay_opacity: 100,
  hero_image_fit: 'cover',
  hero_height_vh: 88,
};

export function clampHeroOverlayOpacity(n) {
  if (n == null || n === '') return HERO_PHOTO_DEFAULTS.hero_overlay_opacity;
  const v = Number(n);
  if (!Number.isFinite(v)) return HERO_PHOTO_DEFAULTS.hero_overlay_opacity;
  return Math.min(100, Math.max(0, Math.round(v)));
}

export function clampHeroHeightVh(n) {
  if (n == null || n === '') return HERO_PHOTO_DEFAULTS.hero_height_vh;
  const v = Number(n);
  if (!Number.isFinite(v)) return HERO_PHOTO_DEFAULTS.hero_height_vh;
  return Math.min(100, Math.max(50, Math.round(v)));
}

export function normalizeHeroImageFit(v) {
  return String(v || '') === 'contain' ? 'contain' : 'cover';
}

/** 0–1 multiplier for existing dark overlay layers. */
export function heroOverlayStrength(appearance) {
  return clampHeroOverlayOpacity(appearance?.hero_overlay_opacity) / 100;
}

export function heroMinHeightCss(appearance, capPx = 820) {
  const vh = clampHeroHeightVh(appearance?.hero_height_vh);
  return `min(${vh}vh, ${capPx}px)`;
}

export function heroBackgroundSize(appearance) {
  return normalizeHeroImageFit(appearance?.hero_image_fit);
}
