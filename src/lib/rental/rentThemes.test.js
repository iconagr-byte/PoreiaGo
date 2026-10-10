/**
 * Smoke test for rent full-page themes catalog.
 */
import {
  DEFAULT_RENT_THEME_ID,
  RENT_HERO_LAYOUTS,
  RENT_THEMES,
  filterRentThemes,
  getRentThemeById,
  normalizeRentFleetLayout,
  rentThemeStyleVars,
  rentThemeToAppearancePatch,
  resolveRentTheme,
} from './rentThemes.js';

console.assert(RENT_THEMES.length === 5, `expected 5 themes, got ${RENT_THEMES.length}`);
console.assert(new Set(RENT_THEMES.map((t) => t.id)).size === 5, 'theme ids must be unique');
console.assert(RENT_HERO_LAYOUTS.includes('split_card'), 'compare hero layout exists');

const combos = new Set(
  RENT_THEMES.map(
    (t) => `${t.rent_hero_style}|${t.rent_fleet_layout_template}|${t.rent_fleet_card_template}`,
  ),
);
console.assert(combos.size === 5, 'each of the 5 themes must be structurally distinct');

const heroLayouts = new Set(
  RENT_THEMES.map((t) => rentThemeToAppearancePatch(t).rent_hero_layout),
);
console.assert(heroLayouts.size === 5, `each theme needs a unique hero layout, got ${heroLayouts.size}`);

console.assert(
  RENT_THEMES.every((t) => t.rent_fleet_layout_template !== 'rent_scroll'),
  'no theme may use horizontal scroll fleet layout',
);
console.assert(normalizeRentFleetLayout('rent_scroll') === 'rent_grid_three', 'legacy scroll remaps to grid');
console.assert(
  resolveRentTheme({ rent_fleet_layout_template: 'rent_scroll' }).fleetLayout === 'rent_grid_three',
  'saved rent_scroll appearance must wrap as a grid',
);

function hexLuma(hex) {
  const h = String(hex || '').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
console.assert(
  RENT_THEMES.every((t) => hexLuma(t.palette.surface) >= 180),
  'theme surfaces must be light (no black fills)',
);

const noirFill = resolveRentTheme({
  rent_theme_id: 'sixt_cinematic',
  rent_surface_color: '#0f172a',
});
console.assert(hexLuma(noirFill.surface) >= 180, 'saved dark surface must lift to a light fill');

const photos = new Set(RENT_THEMES.map((t) => t.hero_image_url));
console.assert(photos.size === 5, `each theme needs a unique hero photo, got ${photos.size}`);
console.assert(
  RENT_THEMES.every((t) => t.hero_image_url && t.header_style),
  'every theme needs hero_image_url + header_style',
);

const def = getRentThemeById(DEFAULT_RENT_THEME_ID);
console.assert(def.id === 'aegean_coast', 'default theme');

const patch = rentThemeToAppearancePatch(def, { includeColors: true });
console.assert(patch.rent_theme_id === 'aegean_coast', 'patch theme id');
console.assert(patch.rent_accent_color === def.palette.primary, 'patch colors');
console.assert(patch.rent_fleet_layout_template === def.rent_fleet_layout_template, 'patch layout');
console.assert(patch.rent_hero_image_url === def.hero_image_url, 'patch hero photo');
console.assert(patch.rent_header_style === def.header_style, 'patch header style');

const layoutOnly = rentThemeToAppearancePatch(def, { includeColors: false });
console.assert(layoutOnly.rent_accent_color === undefined, 'layout-only skips colors');
console.assert(layoutOnly.rent_hero_image_url, 'layout-only still sets hero photo');

const filtered = filterRentThemes({ category: 'premium' });
console.assert(filtered.every((t) => t.category === 'premium'), 'category filter');
console.assert(filtered.length >= 1, 'premium themes exist');

const resolved = resolveRentTheme({
  rent_theme_id: 'discover_compare',
  rent_accent_color: '#2563eb',
});
console.assert(resolved.themeId === 'discover_compare', 'resolve theme');
console.assert(resolved.accent === '#2563eb', 'resolve accent');
console.assert(resolved.heroStyle === 'compare', 'resolve hero');
console.assert(resolved.heroLayout === 'split_card', 'resolve hero layout');
console.assert(resolved.heroImageUrl.includes('unsplash') || resolved.heroImageUrl.startsWith('/'), 'resolve photo');
console.assert(resolved.headerStyle === 'solid', 'resolve header style');

const legacy = resolveRentTheme({ rent_theme_id: 'turo_peer' });
console.assert(legacy.themeId === 'aegean_coast', 'unknown theme ids fall back to default');

const vars = rentThemeStyleVars({ rent_theme_id: 'enterprise_trust' });
console.assert(vars['--rent-teal'], 'css vars accent');
console.assert(vars['--rent-deep'], 'css vars secondary');

console.log('rentThemes: OK');
