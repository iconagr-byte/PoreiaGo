/**
 * Full-page /rent themes — structurally distinct layouts inspired by
 * global rental UX (SIXT, Enterprise, Turo, DiscoverCars, Autoluxe, etc.).
 * Colors are suggested defaults; user can override after picking a theme.
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
 * 20 full-page rent themes — unique hero × fleet × card × mood combinations.
 */
export const RENT_THEMES = [
  {
    id: 'aegean_coast',
    name: 'Aegean Coast',
    nameEl: 'Αιγαίο Coast',
    description: 'Φωτεινό παράκτιο booking hero, 3στήλο στόλο — κλασικό ελληνικό rent.',
    mood: 'Θάλασσα · κράτηση',
    badge: 'Default',
    category: 'coastal',
    tags: ['Coastal', 'Grid 3', 'Teal'],
    layoutLabel: 'Coastal · Grid 3',
    palette: { primary: '#0a7a6c', secondary: '#0b3d4a', hero: '#0f766e', surface: '#f0fdfa' },
    rent_hero_style: 'coastal',
    rent_fleet_layout_template: 'rent_grid_three',
    rent_fleet_card_template: 'rent_premium',
    rent_header_compact: false,
    hero_image_url: '/images/rent-hero-coastal-v2.jpg',
    header_style: 'glass',
  },
  {
    id: 'sixt_cinematic',
    name: 'Cinematic Prestige',
    nameEl: 'Cinematic Prestige',
    description: 'Σκούρο fullscreen hero, featured showroom — premium night booking.',
    mood: 'VIP · νύχτα',
    badge: 'Prestige',
    category: 'premium',
    tags: ['Dark', 'Featured', 'Overlay'],
    layoutLabel: 'Cinematic · Featured',
    palette: { primary: '#f97316', secondary: '#111827', hero: '#0a0a0a', surface: '#fff7ed' },
    rent_hero_style: 'cinematic',
    rent_fleet_layout_template: 'rent_featured',
    rent_fleet_card_template: 'rent_overlay',
    rent_header_compact: true,
    hero_image_url: rentHeroPhoto('1503376789611-9aa2e607e2ae'),
    header_style: 'dark',
  },
  {
    id: 'discover_compare',
    name: 'Compare Deals',
    nameEl: 'Compare Deals',
    description: 'Search-first, πυκνή λίστα σύγκρισης — aggregator style DiscoverCars.',
    mood: 'Τιμή · ταχύτητα',
    badge: 'Compare',
    category: 'bold',
    tags: ['Search', 'List', 'Deals'],
    layoutLabel: 'Compare · List',
    palette: { primary: '#2563eb', secondary: '#0f172a', hero: '#1e3a8a', surface: '#eff6ff' },
    rent_hero_style: 'compare',
    rent_fleet_layout_template: 'rent_list',
    rent_fleet_card_template: 'rent_spec',
    rent_header_compact: true,
    hero_image_url: rentHeroPhoto('1449965408859-eae163525971'),
    header_style: 'solid',
  },
  {
    id: 'turo_peer',
    name: 'Peer Marketplace',
    nameEl: 'Peer Marketplace',
    description: 'Photo-first marketplace, 3στήλο πλέγμα — peer fleet vibe.',
    mood: 'Photo · community',
    badge: 'Marketplace',
    category: 'bold',
    tags: ['Purple', 'Grid', 'Photo'],
    layoutLabel: 'Peer · Grid 3',
    palette: { primary: '#593bfb', secondary: '#5ce0b8', hero: '#0f0f12', surface: '#f5f3ff' },
    rent_hero_style: 'peer',
    rent_fleet_layout_template: 'rent_grid_three',
    rent_fleet_card_template: 'rent_overlay',
    rent_header_compact: false,
    hero_image_url: rentHeroPhoto('1511910849305-0df4eda133e7'),
    header_style: 'brand',
  },
  {
    id: 'enterprise_trust',
    name: 'Enterprise Trust',
    nameEl: 'Enterprise Trust',
    description: 'Καθαρό corporate πράσινο, 2 μεγάλες κάρτες — εμπιστοσύνη & στόλος.',
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
    description: 'Άσπρο, champagne accents, soft cards — boutique Marbella feel.',
    mood: 'Old money · ήρεμο',
    badge: 'Luxe',
    category: 'minimal',
    tags: ['White', 'Soft', 'Champagne'],
    layoutLabel: 'Luxe · Soft 3',
    palette: { primary: '#a8a29e', secondary: '#44403c', hero: '#292524', surface: '#fafaf9' },
    rent_hero_style: 'soft_luxe',
    rent_fleet_layout_template: 'rent_grid_three',
    rent_fleet_card_template: 'rent_soft',
    rent_header_compact: false,
    hero_image_url: rentHeroPhoto('1600596542815-ffad4c1539a9'),
    header_style: 'soft',
  },
  {
    id: 'metro_express',
    name: 'Metro Express',
    nameEl: 'Metro Express',
    description: 'Κόκκινο/μαύρο πόλης, compact rows — γρήγορη κράτηση.',
    mood: 'City · express',
    badge: 'Express',
    category: 'bold',
    tags: ['Red', 'Compact', 'Dense'],
    layoutLabel: 'Metro · Compact',
    palette: { primary: '#dc2626', secondary: '#111827', hero: '#450a0a', surface: '#fef2f2' },
    rent_hero_style: 'metro',
    rent_fleet_layout_template: 'rent_list',
    rent_fleet_card_template: 'rent_compact',
    rent_header_compact: true,
    hero_image_url: rentHeroPhoto('1477959858617-67f85cf4f1df'),
    header_style: 'ink',
  },
  {
    id: 'santorini_sunset',
    name: 'Santorini Sunset',
    nameEl: 'Σαντορίνη Sunset',
    description: 'Θερμό ηλιοβασίλεμα, overlay κάρτες — νησιωτική αφήγηση.',
    mood: 'Ήλιος · νησί',
    badge: 'Island',
    category: 'coastal',
    tags: ['Amber', 'Overlay', 'Warm'],
    layoutLabel: 'Island · Overlay',
    palette: { primary: '#f59e0b', secondary: '#0f766e', hero: '#7c2d12', surface: '#fffbeb' },
    rent_hero_style: 'island',
    rent_fleet_layout_template: 'rent_grid_two',
    rent_fleet_card_template: 'rent_overlay',
    rent_header_compact: false,
    hero_image_url: rentHeroPhoto('1613395877344-13d4a8e0d49e'),
    header_style: 'glass',
  },
  {
    id: 'night_asphalt',
    name: 'Night Asphalt',
    nameEl: 'Night Asphalt',
    description: 'Near-black canvas, φωτογραφίες που «λάμπουν» — dark catalog.',
    mood: 'Dark · photo',
    badge: 'Noir',
    category: 'premium',
    tags: ['Black', 'Featured', 'Overlay'],
    layoutLabel: 'Night · Featured',
    palette: { primary: '#38bdf8', secondary: '#0f172a', hero: '#020617', surface: '#f1f5f9' },
    rent_hero_style: 'night',
    rent_fleet_layout_template: 'rent_featured',
    rent_fleet_card_template: 'rent_overlay',
    rent_header_compact: true,
    hero_image_url: rentHeroPhoto('1493238792150-16ad17bd7908'),
    header_style: 'dark',
  },
  {
    id: 'glass_atlas_rent',
    name: 'Glass Atlas Rent',
    nameEl: 'Glass Atlas',
    description: 'Frosted glass UI, cyan/violet mesh — ultra modern digital-first.',
    mood: 'Futuristic · soft',
    badge: 'Modern',
    category: 'minimal',
    tags: ['Glass', '2-col', 'Cyan'],
    layoutLabel: 'Glass · Soft 2',
    palette: { primary: '#06b6d4', secondary: '#7c3aed', hero: '#312e81', surface: '#ecfeff' },
    rent_hero_style: 'glass',
    rent_fleet_layout_template: 'rent_grid_two',
    rent_fleet_card_template: 'rent_soft',
    rent_header_compact: false,
    hero_image_url: rentHeroPhoto('1486406146926-c627a92ad1ab'),
    header_style: 'glass',
  },
  {
    id: 'sport_orange',
    name: 'Sport Orange',
    nameEl: 'Sport Orange',
    description: 'Ενεργητικό πορτοκαλί, featured + premium cards — performance fleet.',
    mood: 'Energy · drive',
    badge: 'Sport',
    category: 'bold',
    tags: ['Orange', 'Featured', 'Premium'],
    layoutLabel: 'Sport · Featured',
    palette: { primary: '#ea580c', secondary: '#1c1917', hero: '#7c2d12', surface: '#fff7ed' },
    rent_hero_style: 'sport',
    rent_fleet_layout_template: 'rent_featured',
    rent_fleet_card_template: 'rent_premium',
    rent_header_compact: false,
    hero_image_url: rentHeroPhoto('1542362567-b07e54358753'),
    header_style: 'brand',
  },
  {
    id: 'family_sky',
    name: 'Family Sky',
    nameEl: 'Family Sky',
    description: 'Απαλό sky blue, 3στήλο soft — οικογενειακή ενοικίαση.',
    mood: 'Family · calm',
    badge: 'Family',
    category: 'corporate',
    tags: ['Sky', 'Soft', '3-col'],
    layoutLabel: 'Family · Soft 3',
    palette: { primary: '#0ea5e9', secondary: '#0369a1', hero: '#075985', surface: '#f0f9ff' },
    rent_hero_style: 'family',
    rent_fleet_layout_template: 'rent_grid_three',
    rent_fleet_card_template: 'rent_soft',
    rent_header_compact: false,
    hero_image_url: rentHeroPhoto('1469854523086-cc02afe5c88c'),
    header_style: 'soft',
  },
  {
    id: 'autoluxe_editorial',
    name: 'Autoluxe Editorial',
    nameEl: 'Autoluxe Editorial',
    description: 'Monochrome + cognac, 2 μεγάλες κάρτες — luxury marketplace.',
    mood: 'Editorial · cognac',
    badge: 'Editorial',
    category: 'premium',
    tags: ['Cognac', '2-col', 'Overlay'],
    layoutLabel: 'Editorial · 2-col',
    palette: { primary: '#b45309', secondary: '#1c1917', hero: '#0c0a09', surface: '#fafaf9' },
    rent_hero_style: 'editorial',
    rent_fleet_layout_template: 'rent_grid_two',
    rent_fleet_card_template: 'rent_overlay',
    rent_header_compact: false,
    hero_image_url: rentHeroPhoto('1555215695-3004980ad54e'),
    header_style: 'ink',
  },
  {
    id: 'airport_hub',
    name: 'Airport Hub',
    nameEl: 'Airport Hub',
    description: 'Πρακτικό blue-gray, compact list — παραλαβή αεροδρομίου.',
    mood: 'Airport · practical',
    badge: 'Hub',
    category: 'corporate',
    tags: ['Blue-gray', 'List', 'Compact'],
    layoutLabel: 'Airport · List',
    palette: { primary: '#475569', secondary: '#0f172a', hero: '#334155', surface: '#f1f5f9' },
    rent_hero_style: 'airport',
    rent_fleet_layout_template: 'rent_list',
    rent_fleet_card_template: 'rent_compact',
    rent_header_compact: true,
    hero_image_url: rentHeroPhoto('1529070538774-1843cb3265df'),
    header_style: 'solid',
  },
  {
    id: 'ev_mint',
    name: 'EV Mint',
    nameEl: 'EV Mint',
    description: 'Ηλεκτρικό mint, 3στήλο soft στόλος — green mobility.',
    mood: 'EV · clean',
    badge: 'EV',
    category: 'minimal',
    tags: ['Mint', 'Grid', 'Soft'],
    layoutLabel: 'EV · Soft 3',
    palette: { primary: '#10b981', secondary: '#064e3b', hero: '#022c22', surface: '#ecfdf5' },
    rent_hero_style: 'ev',
    rent_fleet_layout_template: 'rent_grid_three',
    rent_fleet_card_template: 'rent_soft',
    rent_header_compact: false,
    hero_image_url: rentHeroPhoto('1593941707882-a5bba14938c7'),
    header_style: 'soft',
  },
  {
    id: 'cyclades_sand',
    name: 'Cyclades Sand',
    nameEl: 'Κυκλάδες Sand',
    description: 'Άμμος & terracotta, premium grid — καλοκαιρινό νησί.',
    mood: 'Sand · summer',
    badge: 'Summer',
    category: 'coastal',
    tags: ['Sand', 'Grid 3', 'Warm'],
    layoutLabel: 'Sand · Premium 3',
    palette: { primary: '#c2410c', secondary: '#78350f', hero: '#9a3412', surface: '#fff7ed' },
    rent_hero_style: 'desert',
    rent_fleet_layout_template: 'rent_grid_three',
    rent_fleet_card_template: 'rent_premium',
    rent_header_compact: false,
    hero_image_url: rentHeroPhoto('1507525428034-b723cf961d3e'),
    header_style: 'glass',
  },
  {
    id: 'alpine_ice',
    name: 'Alpine Ice',
    nameEl: 'Alpine Ice',
    description: 'Παγωμένο slate, soft 2-col — χειμερινές / βόρειες αγορές.',
    mood: 'Ice · crisp',
    badge: 'Alpine',
    category: 'minimal',
    tags: ['Ice', '2-col', 'Soft'],
    layoutLabel: 'Alpine · Soft 2',
    palette: { primary: '#64748b', secondary: '#1e293b', hero: '#0f172a', surface: '#f8fafc' },
    rent_hero_style: 'alpine',
    rent_fleet_layout_template: 'rent_grid_two',
    rent_fleet_card_template: 'rent_soft',
    rent_header_compact: false,
    hero_image_url: rentHeroPhoto('1464822759023-fed69284c2e2'),
    header_style: 'solid',
  },
  {
    id: 'yacht_navy',
    name: 'Yacht Navy',
    nameEl: 'Yacht Navy',
    description: 'Navy & χρυσό, featured luxe — marina / premium coastal.',
    mood: 'Navy · gold',
    badge: 'Yacht',
    category: 'premium',
    tags: ['Navy', 'Featured', 'Premium'],
    layoutLabel: 'Yacht · Featured',
    palette: { primary: '#c9a227', secondary: '#0c1a3a', hero: '#020617', surface: '#f8fafc' },
    rent_hero_style: 'yacht',
    rent_fleet_layout_template: 'rent_featured',
    rent_fleet_card_template: 'rent_premium',
    rent_header_compact: false,
    hero_image_url: rentHeroPhoto('1544551763-46a013bb70d5'),
    header_style: 'dark',
  },
  {
    id: 'deal_flash',
    name: 'Deal Flash',
    nameEl: 'Deal Flash',
    description: 'Υψηλή αντίθεση κίτρινο, compact deals — flash offers χωρίς μαύρο fill.',
    mood: 'Deals · urgency',
    badge: 'Deals',
    category: 'bold',
    tags: ['Yellow', 'Compact', 'List'],
    layoutLabel: 'Deal · Compact',
    palette: { primary: '#eab308', secondary: '#854d0e', hero: '#0a0a0a', surface: '#fefce8' },
    rent_hero_style: 'deal',
    rent_fleet_layout_template: 'rent_list',
    rent_fleet_card_template: 'rent_compact',
    rent_header_compact: true,
    hero_image_url: rentHeroPhoto('1552519507-da3b142c6e3d'),
    header_style: 'brand',
  },
  {
    id: 'classic_teal',
    name: 'Classic Teal',
    nameEl: 'Classic Teal',
    description: 'Το γνώριμο Poreia rent teal — ισορροπημένο showroom 3 στηλών.',
    mood: 'Classic · trust',
    badge: 'Classic',
    category: 'corporate',
    tags: ['Teal', 'Grid 3', 'Premium'],
    layoutLabel: 'Classic · Premium 3',
    palette: { primary: '#0d9488', secondary: '#115e59', hero: '#134e4a', surface: '#f0fdfa' },
    rent_hero_style: 'classic',
    rent_fleet_layout_template: 'rent_grid_three',
    rent_fleet_card_template: 'rent_premium',
    rent_header_compact: false,
    hero_image_url: '/images/rent-hero-coastal-road-4k.jpg',
    header_style: 'glass',
  },
];

export const DEFAULT_RENT_THEME_ID = 'aegean_coast';

export function getRentThemeById(id) {
  return RENT_THEMES.find((t) => t.id === id) || RENT_THEMES[0];
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
    rent_fleet_layout_template: t.rent_fleet_layout_template || 'rent_grid_three',
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
    fleetLayout: appearance.rent_fleet_layout_template || theme.rent_fleet_layout_template,
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
