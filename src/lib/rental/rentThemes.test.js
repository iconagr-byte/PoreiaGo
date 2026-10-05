/**
 * Smoke test for rent full-page themes catalog.
 */
import {
  DEFAULT_RENT_THEME_ID,
  RENT_THEMES,
  filterRentThemes,
  getRentThemeById,
  rentThemeStyleVars,
  rentThemeToAppearancePatch,
  resolveRentTheme,
} from './rentThemes.js';

console.assert(RENT_THEMES.length === 20, `expected 20 themes, got ${RENT_THEMES.length}`);

const ids = new Set(RENT_THEMES.map((t) => t.id));
console.assert(ids.size === 20, 'theme ids must be unique');

const combos = new Set(
  RENT_THEMES.map(
    (t) => `${t.rent_hero_style}|${t.rent_fleet_layout_template}|${t.rent_fleet_card_template}`,
  ),
);
console.assert(combos.size >= 16, 'themes should be structurally distinct');

const layouts = new Set(RENT_THEMES.map((t) => t.rent_fleet_layout_template));
console.assert(layouts.size >= 4, 'should use multiple fleet layouts');

const heroes = new Set(RENT_THEMES.map((t) => t.rent_hero_style));
console.assert(heroes.size >= 12, 'should use many hero styles');

const def = getRentThemeById(DEFAULT_RENT_THEME_ID);
console.assert(def.id === 'aegean_coast', 'default theme');

const patch = rentThemeToAppearancePatch(def, { includeColors: true });
console.assert(patch.rent_theme_id === 'aegean_coast', 'patch theme id');
console.assert(patch.rent_accent_color === def.palette.primary, 'patch colors');
console.assert(patch.rent_fleet_layout_template === def.rent_fleet_layout_template, 'patch layout');

const layoutOnly = rentThemeToAppearancePatch(def, { includeColors: false });
console.assert(layoutOnly.rent_accent_color === undefined, 'layout-only skips colors');

const filtered = filterRentThemes({ category: 'premium' });
console.assert(filtered.every((t) => t.category === 'premium'), 'category filter');
console.assert(filtered.length >= 3, 'premium themes exist');

const resolved = resolveRentTheme({
  rent_theme_id: 'turo_peer',
  rent_accent_color: '#593bfb',
});
console.assert(resolved.themeId === 'turo_peer', 'resolve theme');
console.assert(resolved.accent === '#593bfb', 'resolve accent');
console.assert(resolved.heroStyle === 'peer', 'resolve hero');

const vars = rentThemeStyleVars({ rent_theme_id: 'enterprise_trust' });
console.assert(vars['--rent-teal'], 'css vars accent');
console.assert(vars['--rent-deep'], 'css vars secondary');

console.log('rentThemes: OK');
