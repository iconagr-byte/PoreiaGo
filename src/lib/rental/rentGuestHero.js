/** Guest /rent hero — Rentalcars-style composition (search-first). */

/** Island coastal road — 4K + cool blue grade (cache-busted path). */
export const RENT_GUEST_HERO_IMAGE = '/images/rent-hero-coastal-v2.jpg';

/** True when a homepage hero URL is the Achillio bus demo (or empty → would fall back to it). */
export function isBusDemoHeroUrl(url) {
  const raw = String(url || '').trim().toLowerCase();
  if (!raw) return true;
  return raw.includes('hero-bus-achillio') || raw.includes('achillio');
}

export const RENT_GUEST_HERO = {
  title: 'Ενοικίαση αυτοκινήτου',
  titleAccent: 'στον στόλο του γραφείου',
  subtitle: '',
  tagline: 'Ο στόλος του γραφείου σας, έτοιμος για κράτηση.',
};

/** Trust line under the headline — optional; book-first hero hides these. */
export const RENT_GUEST_HERO_BENEFITS = [
  'Δωρεάν ακύρωση στις περισσότερες κρατήσεις',
  'Πολλαπλά σημεία παραλαβής',
  'Υποστήριξη γραφείου & οδική βοήθεια',
];

/** Default hero search layout knobs (admin-editable). */
export const RENT_GUEST_SEARCH_DEFAULTS = {
  show_dropoff_toggle: true,
  show_promo: true,
  submit_label: 'Δες οχήματα',
};

/** Legacy CTA labels still stored in appearance → map to book-first default. */
const OBSOLETE_RENT_SEARCH_SUBMIT = new Set(['Αναζήτηση', 'Search', 'search']);

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
  const rawSubmit = String(appearance.rent_search_submit_label || '').trim();
  const submitLabel =
    !rawSubmit || OBSOLETE_RENT_SEARCH_SUBMIT.has(rawSubmit)
      ? RENT_GUEST_SEARCH_DEFAULTS.submit_label
      : rawSubmit;
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
