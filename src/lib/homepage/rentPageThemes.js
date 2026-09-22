/**
 * Θέματα σελίδας /rent — διάταξη στόλου + στυλ κάρτας + κείμενα.
 * Apple αισθητική (SF stack στο rent UI), πλήρως custom μετά την εφαρμογή
 * από «Καρτέλες στόλου» / «Όνομα & κείμενα» / χρώματα.
 */

export const RENT_THEME_CATEGORIES = [
  { id: 'all', label: 'Όλα' },
  { id: 'apple', label: 'Apple' },
  { id: 'showroom', label: 'Showroom' },
  { id: 'catalog', label: 'Κατάλογος' },
  { id: 'editorial', label: 'Editorial' },
];

/**
 * 15 φρέσκα θέματα — κάθε ένα με μοναδικό ζεύγος layout × card
 * ώστε να μην μοιάζουν μεταξύ τους ή με Hertz/booking clones.
 */
export const RENT_PAGE_THEMES = [
  {
    id: 'cupertino_soft',
    name: 'Cupertino Soft',
    nameEl: 'Cupertino Soft',
    description: 'Αέρινο 3στήλο με απαλές κάρτες — ήσυχο Apple gray.',
    mood: 'Ήρεμο · SF',
    badge: 'Apple',
    category: 'apple',
    tags: ['Soft', 'Grid 3', 'SF'],
    layoutLabel: 'Grid 3 · Soft',
    rent_fleet_layout_template: 'rent_grid_three',
    rent_fleet_card_template: 'rent_soft',
    palette: { primary: '#0071e3', secondary: '#1d1d1f', surface: '#f5f5f7' },
    rent_hero_title: 'Το όχημά σας, απλά',
    rent_hero_copy: 'Διαλέξτε, κλείστε, παραλάβετε — χωρίς θόρυβο.',
    rent_cta_label: 'Δες στόλο',
  },
  {
    id: 'infinite_runway',
    name: 'Infinite Runway',
    nameEl: 'Infinite Runway',
    description: 'Οριζόντιο scroll με cinematic overlay — σαν runway showroom.',
    mood: 'Κίνηση · night',
    badge: 'Scroll',
    category: 'showroom',
    tags: ['Scroll', 'Overlay', 'Cinematic'],
    layoutLabel: 'Scroll · Overlay',
    rent_fleet_layout_template: 'rent_scroll',
    rent_fleet_card_template: 'rent_overlay',
    palette: { primary: '#0a84ff', secondary: '#000000', surface: '#111111' },
    rent_hero_title: 'Στόλος σε κίνηση',
    rent_hero_copy: 'Σύρετε και επιλέξτε — κάθε όχημα σε πλήρη οθόνη.',
    rent_cta_label: 'Ξεκίνα περιήγηση',
  },
  {
    id: 'spec_lab',
    name: 'Spec Lab',
    nameEl: 'Spec Lab',
    description: 'Λίστα σύγκρισης με spec sheet — αποφάσεις με δεδομένα.',
    mood: 'Λειτουργικό · clear',
    badge: 'Specs',
    category: 'catalog',
    tags: ['List', 'Specs', 'Compare'],
    layoutLabel: 'List · Spec',
    rent_fleet_layout_template: 'rent_list',
    rent_fleet_card_template: 'rent_spec',
    palette: { primary: '#34c759', secondary: '#1d1d1f', surface: '#ffffff' },
    rent_hero_title: 'Σύγκρινε πριν κλείσεις',
    rent_hero_copy: 'Θέσεις, κιβώτιο, καύσιμο και τιμή — σε μία ματιά.',
    rent_cta_label: 'Σύγκριση στόλου',
  },
  {
    id: 'garage_spotlight',
    name: 'Garage Spotlight',
    nameEl: 'Garage Spotlight',
    description: 'Featured showroom + premium κάρτες — VIP πρώτο όχημα.',
    mood: 'VIP · spotlight',
    badge: 'Featured',
    category: 'showroom',
    tags: ['Featured', 'Premium'],
    layoutLabel: 'Featured · Premium',
    rent_fleet_layout_template: 'rent_featured',
    rent_fleet_card_template: 'rent_premium',
    palette: { primary: '#1d1d1f', secondary: '#86868b', surface: '#fbfbfd' },
    rent_hero_title: 'Το highlight του στόλου',
    rent_hero_copy: 'Το πρώτο όχημα σε μεγάλο πλάνο — τα υπόλοιπα δίπλα.',
    rent_cta_label: 'Δες highlight',
  },
  {
    id: 'twin_stage',
    name: 'Twin Stage',
    nameEl: 'Twin Stage',
    description: 'Δύο μεγάλες editorial κάρτες — boutique στόλος.',
    mood: 'Boutique · type',
    badge: 'Twin',
    category: 'editorial',
    tags: ['2 στήλες', 'Editorial'],
    layoutLabel: 'Grid 2 · Editorial',
    rent_fleet_layout_template: 'rent_grid_two',
    rent_fleet_card_template: 'rent_editorial',
    palette: { primary: '#0071e3', secondary: '#1d1d1f', surface: '#ffffff' },
    rent_hero_title: 'Λίγα, προσεγμένα',
    rent_hero_copy: 'Μεγάλη τυπογραφία, λίγα οχήματα — χωρίς κατάλογο-θόρυβο.',
    rent_cta_label: 'Επίλεξε',
  },
  {
    id: 'glass_pavilion',
    name: 'Glass Pavilion',
    nameEl: 'Glass Pavilion',
    description: 'Bento garage με glass κάρτες — Cupertino pavilion.',
    mood: 'Glass · bento',
    badge: 'Glass',
    category: 'apple',
    tags: ['Bento', 'Glass', 'Apple'],
    layoutLabel: 'Bento · Glass',
    rent_fleet_layout_template: 'rent_bento',
    rent_fleet_card_template: 'rent_glass',
    palette: { primary: '#64d2ff', secondary: '#1d1d1f', surface: '#e8f4fc' },
    rent_hero_title: 'Διαφάνεια & χώρος',
    rent_hero_copy: 'Ασύμμετρο bento με ημιδιαφανείς κάρτες.',
    rent_cta_label: 'Άνοιξε pavilion',
  },
  {
    id: 'price_strip',
    name: 'Price Strip',
    nameEl: 'Price Strip',
    description: 'Συμπαγής λίστα με τιμή πρώτα — γρήγορη απόφαση.',
    mood: 'Conversion · clear',
    badge: 'Price',
    category: 'catalog',
    tags: ['List', 'Price first'],
    layoutLabel: 'List · Price first',
    rent_fleet_layout_template: 'rent_list',
    rent_fleet_card_template: 'rent_price_first',
    palette: { primary: '#ff9f0a', secondary: '#1d1d1f', surface: '#fff9f0' },
    rent_hero_title: 'Τιμή στην πρώτη γραμμή',
    rent_hero_copy: 'Μεγάλη τιμή, μικρή φωτό — για όσους ξέρουν τι θέλουν.',
    rent_cta_label: 'Δες τιμές',
  },
  {
    id: 'magazine_fleet',
    name: 'Magazine Fleet',
    nameEl: 'Magazine Fleet',
    description: 'Ψηλή editorial στοίβα — storytelling στόλου σαν περιοδικό.',
    mood: 'Story · print',
    badge: 'Mag',
    category: 'editorial',
    tags: ['Magazine', 'Overlay'],
    layoutLabel: 'Magazine · Overlay',
    rent_fleet_layout_template: 'rent_magazine',
    rent_fleet_card_template: 'rent_overlay',
    palette: { primary: '#bf5af2', secondary: '#1d1d1f', surface: '#faf8ff' },
    rent_hero_title: 'Κάθε όχημα, μια ιστορία',
    rent_hero_copy: 'Πλήρες πλάτος, cinematic φωτογραφία, λίγο κείμενο.',
    rent_cta_label: 'Φύλλισε στόλο',
  },
  {
    id: 'pill_catalog',
    name: 'Pill Catalog',
    nameEl: 'Pill Catalog',
    description: 'Πυκνό κατάλογο με pill CTA — Maps / Wallet chrome.',
    mood: 'Dense · CTA',
    badge: 'Pills',
    category: 'catalog',
    tags: ['Dense', 'Pill', 'Apple'],
    layoutLabel: 'Dense · Pill',
    rent_fleet_layout_template: 'rent_dense',
    rent_fleet_card_template: 'rent_pill',
    palette: { primary: '#0071e3', secondary: '#6e6e73', surface: '#f5f5f7' },
    rent_hero_title: 'Γρήγορη επιλογή',
    rent_hero_copy: 'Πολλά οχήματα, καθαρά pills — ένα tap για κράτηση.',
    rent_cta_label: 'Κλείσε τώρα',
  },
  {
    id: 'studio_white',
    name: 'Studio White',
    nameEl: 'Studio White',
    description: 'Λευκό studio, soft κάρτες σε 2 στήλες — μηδέν διακόσμηση.',
    mood: 'Zero noise',
    badge: 'Clean',
    category: 'apple',
    tags: ['White', 'Soft', '2 στήλες'],
    layoutLabel: 'Grid 2 · Soft',
    rent_fleet_layout_template: 'rent_grid_two',
    rent_fleet_card_template: 'rent_soft',
    palette: { primary: '#1d1d1f', secondary: '#86868b', surface: '#ffffff' },
    rent_hero_title: 'Καθαρό. Άσπρο. Δικό σας.',
    rent_hero_copy: 'Μόνο όχημα, τιμή και κουμπί — χωρίς διακοσμητικό θόρυβο.',
    rent_cta_label: 'Επίλεξε όχημα',
  },
  {
    id: 'night_drive',
    name: 'Night Drive',
    nameEl: 'Night Drive',
    description: 'Featured + overlay σε σκούρο — night drive vibe.',
    mood: 'Dark · premium',
    badge: 'Night',
    category: 'showroom',
    tags: ['Featured', 'Dark', 'Overlay'],
    layoutLabel: 'Featured · Overlay',
    rent_fleet_layout_template: 'rent_featured',
    rent_fleet_card_template: 'rent_overlay',
    palette: { primary: '#0a84ff', secondary: '#f5f5f7', surface: '#1c1c1e' },
    rent_hero_title: 'Νυχτερινό showroom',
    rent_hero_copy: 'Σκούρο φόντο, φωτεινές φωτογραφίες, έντονη τιμή.',
    rent_cta_label: 'Οδήγησε απόψε',
  },
  {
    id: 'atlas_quiet',
    name: 'Atlas Quiet',
    nameEl: 'Atlas Quiet',
    description: 'Συμπαγής λίστα + compact rows — ήσυχος κατάλογος.',
    mood: 'Quiet · scan',
    badge: 'Quiet',
    category: 'catalog',
    tags: ['List', 'Compact'],
    layoutLabel: 'List · Compact',
    rent_fleet_layout_template: 'rent_list',
    rent_fleet_card_template: 'rent_compact',
    palette: { primary: '#5856d6', secondary: '#1d1d1f', surface: '#f2f2f7' },
    rent_hero_title: 'Γρήγορη σάρωση',
    rent_hero_copy: 'Οριζόντιες σειρές για όσους θέλουν απλά να συγκρίνουν.',
    rent_cta_label: 'Σάρωσε στόλο',
  },
  {
    id: 'charge_grid',
    name: 'Charge Grid',
    nameEl: 'Charge Grid',
    description: 'Πυκνό grid με glass — EV / modern charge energy.',
    mood: 'Modern · energy',
    badge: 'Charge',
    category: 'apple',
    tags: ['Dense', 'Glass', 'Modern'],
    layoutLabel: 'Dense · Glass',
    rent_fleet_layout_template: 'rent_dense',
    rent_fleet_card_template: 'rent_glass',
    palette: { primary: '#30d158', secondary: '#1d1d1f', surface: '#f0fff4' },
    rent_hero_title: 'Σύγχρονος στόλος',
    rent_hero_copy: 'Πυκνό πλέγμα με διαφάνεια — ιδανικό για μεγάλο στόλο.',
    rent_cta_label: 'Δες όλα',
  },
  {
    id: 'editorial_lane',
    name: 'Editorial Lane',
    nameEl: 'Editorial Lane',
    description: 'Magazine stack με μεγάλη τυπογραφία — brand storytelling.',
    mood: 'Brand · type',
    badge: 'Type',
    category: 'editorial',
    tags: ['Magazine', 'Editorial type'],
    layoutLabel: 'Magazine · Editorial',
    rent_fleet_layout_template: 'rent_magazine',
    rent_fleet_card_template: 'rent_editorial',
    palette: { primary: '#ff375f', secondary: '#1d1d1f', surface: '#fff5f7' },
    rent_hero_title: 'Η μάρκα σας, μπροστά',
    rent_hero_copy: 'Τυπογραφία πρώτα — το όχημα ακολουθεί σαν editorial.',
    rent_cta_label: 'Διάβασε & κλείσε',
  },
  {
    id: 'dual_pill',
    name: 'Dual Pill',
    nameEl: 'Dual Pill',
    description: 'Δύο μεγάλες κάρτες με pill chrome — Maps-style CTA.',
    mood: 'CTA · dual',
    badge: 'Dual',
    category: 'showroom',
    tags: ['Grid 2', 'Pill'],
    layoutLabel: 'Grid 2 · Pill',
    rent_fleet_layout_template: 'rent_grid_two',
    rent_fleet_card_template: 'rent_pill',
    palette: { primary: '#0071e3', secondary: '#1d1d1f', surface: '#f5f5f7' },
    rent_hero_title: 'Δύο ξεκάθαρες επιλογές',
    rent_hero_copy: 'Μεγάλα pills, καθαρό CTA — χωρίς δισταγμό.',
    rent_cta_label: 'Επίλεξε πλευρά',
  },
];

export const DEFAULT_RENT_THEME_ID = 'cupertino_soft';

export function getRentPageThemeById(id) {
  return RENT_PAGE_THEMES.find((t) => t.id === id) || RENT_PAGE_THEMES[0];
}

/**
 * @param {{ includeColors?: boolean, includeCopy?: boolean }} options
 */
export function rentThemeToAppearancePatch(theme, { includeColors = false, includeCopy = true } = {}) {
  const t = theme || getRentPageThemeById(DEFAULT_RENT_THEME_ID);
  const patch = {
    rent_theme_id: t.id,
    rent_fleet_layout_template: t.rent_fleet_layout_template,
    rent_fleet_card_template: t.rent_fleet_card_template,
  };
  if (includeCopy) {
    if (t.rent_hero_title) patch.rent_hero_title = t.rent_hero_title;
    if (t.rent_hero_copy) patch.rent_hero_copy = t.rent_hero_copy;
    if (t.rent_cta_label) patch.rent_cta_label = t.rent_cta_label;
  }
  if (includeColors && t.palette) {
    patch.accent_color = t.palette.primary;
    patch.secondary_color = t.palette.secondary;
    patch.surface_color = t.palette.surface;
  }
  return patch;
}

export function filterRentThemes({ category = 'all', query = '' } = {}) {
  const q = query.trim().toLowerCase();
  return RENT_PAGE_THEMES.filter((t) => {
    if (category !== 'all' && t.category !== category) return false;
    if (!q) return true;
    const hay = [t.name, t.nameEl, t.description, t.mood, t.layoutLabel, ...(t.tags || [])]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}
