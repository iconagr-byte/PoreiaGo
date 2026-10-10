/**
 * Five full-page /rent themes — original Poreia compositions.
 * Distinct hero/search, wrapping fleet grids, transparent fills. No carousels.
 */

export const RENT_THEME_CATEGORIES = [
  { id: 'all', label: 'Όλα', icon: 'apps' },
  { id: 'premium', label: 'Premium', icon: 'diamond' },
  { id: 'minimal', label: 'Minimal', icon: 'crop_free' },
  { id: 'bold', label: 'Έντονα', icon: 'bolt' },
  { id: 'corporate', label: 'Corporate', icon: 'business_center' },
  { id: 'coastal', label: 'Παράκτια', icon: 'waves' },
];

/** Valid rent hero presentation modes (CSS data-rent-hero). */
export const RENT_HERO_STYLES = [
  'coastal',
  'cinematic',
  'compare',
  'peer',
  'corporate',
  'soft_luxe',
  'metro',
  'island',
  'night',
  'glass',
  'sport',
  'family',
  'editorial',
  'airport',
  'ev',
  'desert',
  'alpine',
  'yacht',
  'deal',
  'classic',
];


/** Header chrome modes for .rent-topbar (data-rent-header). */
export const RENT_HEADER_STYLES = ['glass', 'solid', 'dark', 'brand', 'ink', 'soft'];

/** Curated hero photos — Unsplash or local path. */
export function rentHeroPhoto(idOrPath) {
  const raw = String(idOrPath || '').trim();
  if (!raw) return '/images/rent-hero-coastal-v2.jpg';
  if (raw.startsWith('/') || raw.startsWith('http')) return raw;
  return `https://images.unsplash.com/photo-${raw}?auto=format&fit=crop&w=2000&q=85`;
}

export function normalizeRentHeaderStyle(value) {
  const mode = String(value || '').trim().toLowerCase();
  return RENT_HEADER_STYLES.includes(mode) ? mode : 'glass';
}

/**
 * Distinct hero compositions — one original Poreia layout per theme.
 * Inspired by common rental UX patterns (promo+card, strip, dock, etc.)
 * without copying any brand’s assets, copy, or exact chrome.
 */
export const RENT_HERO_LAYOUTS = [
  'strip',
  'cinematic',
  'split_card',
  'side_search',
  'stacked_panel',
  'luxe_veil',
  'compact_bar',
  'island_float',
  'bottom_dock',
  'glass_center',
  'asymmetric',
  'trust_stack',
  'editorial',
  'ticket_board',
  'soft_orb',
  'wide_horizon',
  'frost_panel',
  'deck_tiers',
  'deal_banner',
  'showroom',
];

export function normalizeRentHeroLayout(value) {
  const mode = String(value || '').trim().toLowerCase();
  return RENT_HERO_LAYOUTS.includes(mode) ? mode : 'strip';
}

/** Exactly one unique layout per hero style / theme. */
const HERO_LAYOUT_BY_STYLE = {
  coastal: 'strip',
  cinematic: 'cinematic',
  compare: 'split_card',
  peer: 'side_search',
  corporate: 'stacked_panel',
  soft_luxe: 'luxe_veil',
  metro: 'compact_bar',
  island: 'island_float',
  night: 'bottom_dock',
  glass: 'glass_center',
  sport: 'asymmetric',
  family: 'trust_stack',
  editorial: 'editorial',
  airport: 'ticket_board',
  ev: 'soft_orb',
  desert: 'wide_horizon',
  alpine: 'frost_panel',
  yacht: 'deck_tiers',
  deal: 'deal_banner',
  classic: 'showroom',
};

/**
 * Five full-page /rent themes — each a distinct original composition.
 * No carousel / no horizontal scroll. Fleet fills stay transparent.
 */
export const RENT_THEMES = [
  {
    id: 'aegean_coast',
    name: 'Aegean Coast',
    nameEl: 'Αιγαίο Coast',
    description: 'Φωτεινό παράκτιο booking strip, wrapping 3στήλο στόλο — default ελληνικό rent.',
    mood: 'Θάλασσα · κράτηση',
    badge: 'Default',
    category: 'coastal',
    tags: ['Coastal', 'Grid', 'Teal'],
    layoutLabel: 'Coastal · Grid',
    palette: { primary: '#0a7a6c', secondary: '#0b3d4a', hero: '#0f766e', surface: '#f0fdfa' },
    rent_hero_style: 'coastal',
    rent_fleet_layout_template: 'rent_grid_three',
    rent_fleet_card_template: 'rent_premium',
    rent_header_compact: false,
    hero_image_url: '/images/rent-hero-coastal-v2.jpg',
    header_style: 'glass',
  },
  {
    id: 'discover_compare',
    name: 'Compare Deals',
    nameEl: 'Compare Deals',
    description: 'Promo αριστερά + κάρτα κράτησης δεξιά, λίστα σύγκρισης — χωρίς carousel.',
    mood: 'Τιμή · ταχύτητα',
    badge: 'Compare',
    category: 'bold',
    tags: ['Search', 'List', 'Deals'],
    layoutLabel: 'Compare · List',
    palette: { primary: '#2563eb', secondary: '#1e3a8a', hero: '#1e3a8a', surface: '#eff6ff' },
    rent_hero_style: 'compare',
    rent_fleet_layout_template: 'rent_list',
    rent_fleet_card_template: 'rent_spec',
    rent_header_compact: true,
    hero_image_url: rentHeroPhoto('1449965408859-eae163525971'),
    header_style: 'solid',
  },
  {
    id: 'enterprise_trust',
    name: 'Enterprise Trust',
    nameEl: 'Enterprise Trust',
    description: 'Corporate stacked form, 2στήλο wrapping πλέγμα — εμπιστοσύνη & στόλος.',
    mood: 'Trust · clean',
    badge: 'Corporate',
    category: 'corporate',
    tags: ['Green', '2-col', 'Soft'],
    layoutLabel: 'Trust · 2-col',
    palette: { primary: '#15803d', secondary: '#14532d', hero: '#166534', surface: '#f0fdf4' },
    rent_hero_style: 'corporate',
    rent_fleet_layout_template: 'rent_grid_two',
    rent_fleet_card_template: 'rent_soft',
    rent_header_compact: false,
    hero_image_url: rentHeroPhoto('1485291571150-772bff949ba0'),
    header_style: 'solid',
  },
  {
    id: 'quiet_luxe',
    name: 'Quiet Luxury',
    nameEl: 'Quiet Luxury',
    description: 'Champagne veil hero, soft wrapping κάρτες — boutique χωρίς fill slab.',
    mood: 'Old money · ήρεμο',
    badge: 'Luxe',
    category: 'minimal',
    tags: ['White', 'Soft', 'Champagne'],
    layoutLabel: 'Luxe · Soft',
    palette: { primary: '#a8a29e', secondary: '#44403c', hero: '#292524', surface: '#fafaf9' },
    rent_hero_style: 'soft_luxe',
    rent_fleet_layout_template: 'rent_grid_three',
    rent_fleet_card_template: 'rent_soft',
    rent_header_compact: false,
    hero_image_url: rentHeroPhoto('1600596542815-ffad4c1539a9'),
    header_style: 'soft',
  },
  {
    id: 'sixt_cinematic',
    name: 'Cinematic Prestige',
    nameEl: 'Cinematic Prestige',
    description: 'Fullscreen film hero, wrapping showroom — premium χωρίς μαύρο fill.',
    mood: 'VIP · νύχτα',
    badge: 'Prestige',
    category: 'premium',
    tags: ['Cinematic', 'Grid', 'Premium'],
    layoutLabel: 'Cinematic · Grid',
    palette: { primary: '#f97316', secondary: '#7c2d12', hero: '#0a0a0a', surface: '#fff7ed' },
    rent_hero_style: 'cinematic',
    rent_fleet_layout_template: 'rent_grid_three',
    rent_fleet_card_template: 'rent_premium',
    rent_header_compact: true,
    hero_image_url: rentHeroPhoto('1503376789611-9aa2e607e2ae'),
    header_style: 'glass',
  },
];

export const DEFAULT_RENT_THEME_ID = 'aegean_coast';

export const RENT_FLEET_LAYOUTS = ['rent_grid_three', 'rent_grid_two', 'rent_list', 'rent_featured'];

export function getRentThemeById(id) {
  return RENT_THEMES.find((t) => t.id === id) || RENT_THEMES[0];
}

export function normalizeRentFleetLayout(value) {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'rent_scroll') return 'rent_grid_three';
  return RENT_FLEET_LAYOUTS.includes(mode) ? mode : 'rent_grid_three';
}

export function normalizeRentHeroStyle(value) {
  const mode = String(value || '').trim().toLowerCase();
  return RENT_HERO_STYLES.includes(mode) ? mode : 'coastal';
}

/**
 * Theme → site_appearance patch.
 * @param {{ includeColors?: boolean }} options
 */
export function rentThemeToAppearancePatch(theme, { includeColors = false } = {}) {
  const t = theme || getRentThemeById(DEFAULT_RENT_THEME_ID);
  const patch = {
    rent_theme_id: t.id,
    rent_hero_style: normalizeRentHeroStyle(t.rent_hero_style),
    rent_hero_layout:
      t.hero_layout ||
      HERO_LAYOUT_BY_STYLE[normalizeRentHeroStyle(t.rent_hero_style)] ||
      'strip',
    rent_fleet_layout_template: normalizeRentFleetLayout(t.rent_fleet_layout_template),
    rent_fleet_card_template: t.rent_fleet_card_template || 'rent_premium',
    rent_header_compact: t.rent_header_compact === true,
    rent_hero_image_url: rentHeroPhoto(t.hero_image_url),
    rent_header_style: normalizeRentHeaderStyle(t.header_style),
  };
  if (includeColors && t.palette) {
    patch.rent_accent_color = t.palette.primary;
    patch.rent_secondary_color = t.palette.secondary;
    patch.rent_surface_color = t.palette.surface;
  }
  return patch;
}

export function filterRentThemes({ category = 'all', query = '' } = {}) {
  const q = query.trim().toLowerCase();
  return RENT_THEMES.filter((t) => {
    if (category !== 'all' && t.category !== category) return false;
    if (!q) return true;
    const hay = [t.name, t.nameEl, t.description, t.mood, t.layoutLabel, ...(t.tags || [])]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

function normalizeHex(value, fallback) {
  const raw = String(value || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
  return fallback;
}

function hexToRgba(hex, alpha) {
  const h = normalizeHex(hex, '#0a7a6c').slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Page/fleet fills must stay light — never a black slab. */
function ensureLightSurface(hex, fallback = '#f5f5f7') {
  const color = normalizeHex(hex, fallback);
  const lumaOf = (value) => {
    const h = value.slice(1);
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };
  if (lumaOf(color) >= 180) return color;
  const fb = normalizeHex(fallback, '#f5f5f7');
  return lumaOf(fb) >= 180 ? fb : '#f5f5f7';
}

/** Resolve active rent theme + colors from site appearance. */
export function resolveRentTheme(appearance = {}) {
  const theme = getRentThemeById(appearance.rent_theme_id || DEFAULT_RENT_THEME_ID);
  const accent = normalizeHex(
    appearance.rent_accent_color || theme.palette.primary,
    theme.palette.primary,
  );
  const secondary = normalizeHex(
    appearance.rent_secondary_color || theme.palette.secondary,
    theme.palette.secondary,
  );
  const surface = ensureLightSurface(
    appearance.rent_surface_color || theme.palette.surface,
    theme.palette.surface,
  );
  const heroImageUrl = rentHeroPhoto(
    appearance.rent_hero_image_url || theme.hero_image_url || '/images/rent-hero-coastal-v2.jpg',
  );
  const headerStyle = normalizeRentHeaderStyle(
    appearance.rent_header_style || theme.header_style || 'glass',
  );
  return {
    theme,
    themeId: theme.id,
    heroStyle: normalizeRentHeroStyle(appearance.rent_hero_style || theme.rent_hero_style),
    heroLayout: normalizeRentHeroLayout(
      appearance.rent_hero_layout ||
        theme.hero_layout ||
        HERO_LAYOUT_BY_STYLE[normalizeRentHeroStyle(appearance.rent_hero_style || theme.rent_hero_style)],
    ),
    heroImageUrl,
    headerStyle,
    fleetLayout: normalizeRentFleetLayout(
      appearance.rent_fleet_layout_template || theme.rent_fleet_layout_template,
    ),
    fleetCard: appearance.rent_fleet_card_template || theme.rent_fleet_card_template,
    headerCompact:
      appearance.rent_header_compact !== undefined && appearance.rent_header_compact !== null
        ? appearance.rent_header_compact === true
        : theme.rent_header_compact === true,
    accent,
    secondary,
    surface,
  };
}

/** CSS custom properties for .rent-app theming. */
export function rentThemeStyleVars(appearance = {}) {
  const resolved = resolveRentTheme(appearance);
  const { accent, secondary, surface } = resolved;
  return {
    ['--rent-teal']: accent,
    ['--rent-deep']: secondary,
    ['--rent-blue']: accent,
    ['--rent-fill']: surface,
    ['--rent-sand']: surface,
    ['--rent-foam']: surface,
    ['--rent-mist']: hexToRgba(accent, 0.16),
    ['--wallet-accent']: accent,
    ['--wallet-accent-deep']: secondary,
    ['--wallet-accent-soft']: hexToRgba(accent, 0.12),
    ['--wallet-mint']: accent,
    ['--wallet-mint-soft']: hexToRgba(accent, 0.12),
    ['--wallet-sand']: surface,
  };
}
