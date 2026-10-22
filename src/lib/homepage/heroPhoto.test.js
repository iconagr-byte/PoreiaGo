import {
  clampHeroHeightVh,
  clampHeroOverlayOpacity,
  heroBackgroundSize,
  heroMinHeightCss,
  heroOverlayStrength,
  normalizeHeroImageFit,
} from './heroPhoto.js';

console.assert(clampHeroOverlayOpacity(null) === 100, 'overlay default');
console.assert(clampHeroOverlayOpacity(-10) === 0, 'overlay floor');
console.assert(clampHeroOverlayOpacity(140) === 100, 'overlay ceil');
console.assert(clampHeroHeightVh(40) === 50, 'height floor');
console.assert(clampHeroHeightVh(120) === 100, 'height ceil');
console.assert(normalizeHeroImageFit('contain') === 'contain', 'fit contain');
console.assert(normalizeHeroImageFit('weird') === 'cover', 'fit fallback');
console.assert(heroBackgroundSize({ hero_image_fit: 'contain' }) === 'contain', 'bg size');
console.assert(heroOverlayStrength({ hero_overlay_opacity: 50 }) === 0.5, 'overlay strength');
console.assert(
  heroMinHeightCss({ hero_height_vh: 80 }, 820) === 'min(80vh, 820px)',
  'min height css',
);

console.log('heroPhoto.test.js ok');
