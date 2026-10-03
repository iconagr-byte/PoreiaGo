/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { RENT_FLEET_CARD_TEMPLATES, RENT_FLEET_LAYOUT_TEMPLATES } from './homepageTemplates.js';
import {
  RENT_PAGE_THEMES,
  getRentPageThemeById,
  rentThemeToAppearancePatch,
} from './rentPageThemes.js';

describe('rent page themes', () => {
  it('has exactly 15 themes', () => {
    expect(RENT_PAGE_THEMES).toHaveLength(15);
  });

  it('uses unique ids and unique layout×card pairs', () => {
    const ids = RENT_PAGE_THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(15);
    const pairs = RENT_PAGE_THEMES.map(
      (t) => `${t.rent_fleet_layout_template}::${t.rent_fleet_card_template}`,
    );
    expect(new Set(pairs).size).toBe(15);
  });

  it('references only known layout/card templates', () => {
    const layouts = new Set(RENT_FLEET_LAYOUT_TEMPLATES.map((t) => t.id));
    const cards = new Set(RENT_FLEET_CARD_TEMPLATES.map((t) => t.id));
    for (const t of RENT_PAGE_THEMES) {
      expect(layouts.has(t.rent_fleet_layout_template)).toBe(true);
      expect(cards.has(t.rent_fleet_card_template)).toBe(true);
    }
  });

  it('patches layout by default and optional colors/copy', () => {
    const theme = getRentPageThemeById('cupertino_soft');
    const base = rentThemeToAppearancePatch(theme, { includeColors: false, includeCopy: false });
    expect(base.rent_theme_id).toBe('cupertino_soft');
    expect(base.rent_fleet_layout_template).toBe('rent_grid_three');
    expect(base.rent_fleet_card_template).toBe('rent_soft');
    expect(base.accent_color).toBeUndefined();
    expect(base.rent_hero_title).toBeUndefined();

    const full = rentThemeToAppearancePatch(theme, { includeColors: true, includeCopy: true });
    expect(full.accent_color).toBe(theme.palette.primary);
    expect(full.rent_hero_title).toBe(theme.rent_hero_title);
  });
});
