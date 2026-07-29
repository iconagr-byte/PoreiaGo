/**
 * Rent customer app branding — office name + hero copy on /rent.
 * Stored on site_appearance; empty fields fall back to office legal name / defaults.
 */

export const DEFAULT_RENT_APP_BRANDING = {
  rent_office_name: '',
  rent_hero_title: 'Το όχημά σας, σε λίγα βήματα',
  rent_hero_copy:
    'Κράτηση, ημερολόγιο και χάρτης παραλαβής — όλα σε μία σελίδα.',
  rent_guest_hero_title: 'Δες τον στόλο πριν κλείσεις',
  rent_guest_hero_copy:
    'Επιβατικά και van με τιμές, θέσεις και περιγραφή — σύνδεση μόνο όταν είσαι έτοιμος για κράτηση.',
  rent_cta_label: 'Βρες όχημα',
};

/**
 * @param {object} appearance
 * @param {{ guest?: boolean }} [opts]
 */
export function resolveRentAppBranding(appearance = {}, opts = {}) {
  const guest = Boolean(opts.guest);
  const office =
    String(appearance.rent_office_name || '').trim() ||
    String(appearance.footer_brand_name || '').trim() ||
    String(appearance.display_name || '').trim() ||
    'Ενοικίαση';

  const title = guest
    ? String(appearance.rent_guest_hero_title || '').trim() ||
      DEFAULT_RENT_APP_BRANDING.rent_guest_hero_title
    : String(appearance.rent_hero_title || '').trim() ||
      DEFAULT_RENT_APP_BRANDING.rent_hero_title;

  const copy = guest
    ? String(appearance.rent_guest_hero_copy || '').trim() ||
      DEFAULT_RENT_APP_BRANDING.rent_guest_hero_copy
    : String(appearance.rent_hero_copy || '').trim() ||
      DEFAULT_RENT_APP_BRANDING.rent_hero_copy;

  const cta =
    String(appearance.rent_cta_label || '').trim() ||
    DEFAULT_RENT_APP_BRANDING.rent_cta_label;

  return {
    officeName: office,
    brandLabel: office,
    title,
    copy,
    ctaLabel: cta,
    isCustomized: Boolean(
      String(appearance.rent_office_name || '').trim() ||
        String(appearance.rent_hero_title || '').trim() ||
        String(appearance.rent_hero_copy || '').trim(),
    ),
  };
}
