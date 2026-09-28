/** Guest /rent hero — Rentalcars-style composition (search-first). */

/** POV from inside the car — coastal road + sea through the windshield. */
export const RENT_GUEST_HERO_IMAGE =
  'https://images.unsplash.com/photo-1773680176161-b140f9019ebb?auto=format&fit=crop&w=2000&q=85';

export const RENT_GUEST_HERO = {
  title: 'Ενοικίαση αυτοκινήτου',
  titleAccent: '— αναζήτησε, σύγκρινε & κλείσε',
  subtitle: '',
  tagline: 'Ο στόλος του γραφείου σας, έτοιμος για κράτηση.',
};

/** Trust line under the headline (Rentalcars-style checks). */
export const RENT_GUEST_HERO_BENEFITS = [
  'Δωρεάν ακύρωση στις περισσότερες κρατήσεις',
  'Πολλαπλά σημεία παραλαβής',
  'Υποστήριξη γραφείου & οδική βοήθεια',
];

/** Default hero search-strip layout knobs (admin-editable). */
export const RENT_GUEST_SEARCH_DEFAULTS = {
  show_dropoff_toggle: true,
  show_promo: true,
  submit_label: 'Αναζήτηση',
};

/**
 * Normalize admin-stored benefits (array or newline text) → clean string list.
 * Empty / missing → default checkmarks.
 * @param {unknown} raw
 * @param {{ allowEmpty?: boolean }} [opts]
 * @returns {string[]}
 */
export function resolveRentGuestHeroBenefits(raw, opts = {}) {
  let items = [];
  if (Array.isArray(raw)) {
    items = raw.map((x) => String(x || '').trim()).filter(Boolean);
  } else if (typeof raw === 'string') {
    items = raw
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  if (items.length) return items.slice(0, 8);
  if (opts.allowEmpty) return [];
  return [...RENT_GUEST_HERO_BENEFITS];
}

/**
 * @param {object} [appearance]
 */
export function resolveRentGuestSearchLayout(appearance = {}) {
  const showDropoff =
    appearance.rent_search_show_dropoff_toggle !== false &&
    appearance.rent_search_show_dropoff_toggle !== 'false';
  const showPromo =
    appearance.rent_search_show_promo !== false &&
    appearance.rent_search_show_promo !== 'false';
  const submitLabel =
    String(appearance.rent_search_submit_label || '').trim() ||
    RENT_GUEST_SEARCH_DEFAULTS.submit_label;
  return {
    showDropoffToggle: showDropoff,
    showPromo,
    submitLabel,
  };
}

/**
 * @param {{ carCount?: number, vanCount?: number }} [counts]
 */
export function rentGuestHeroStats({ carCount = 0, vanCount = 0 } = {}) {
  return [
    {
      value: carCount > 0 ? String(carCount) : 'Cars',
      label: 'Επιβατικά στον στόλο',
      accent: false,
    },
    {
      value: vanCount > 0 ? String(vanCount) : 'Van',
      label: 'Van για ομάδες',
      accent: false,
    },
    {
      value: 'CDW',
      label: 'Ασφάλεια & κάλυψη',
      accent: true,
    },
    {
      value: '24/7',
      label: 'Οδική βοήθεια',
      accent: false,
    },
  ];
}
