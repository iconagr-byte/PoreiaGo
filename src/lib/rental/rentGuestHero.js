/** Guest /rent hero — Rentalcars-style composition (search-first). */

export const RENT_GUEST_HERO_IMAGE =
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=2000&q=85';

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
