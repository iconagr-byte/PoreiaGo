/**
 * Rent customer app branding — office name + hero copy on /rent.
 * Stored on site_appearance; empty fields fall back to office legal name / defaults.
 */

export const DEFAULT_RENT_APP_BRANDING = {
  rent_office_name: '',
  rent_hero_title: 'Το όχημά σας, σε λίγα βήματα',
  rent_hero_copy:
    'Κράτηση, ημερολόγιο και χάρτης παραλαβής — όλα σε μία σελίδα.',
  rent_guest_hero_title: 'Ενοικίαση αυτοκινήτου & van',
  rent_guest_hero_title_accent: 'για όλο το ταξίδι σας',
  rent_guest_hero_copy: '',
  rent_cta_label: 'Βρες όχημα',
};

/** Legacy guest copy removed from /rent hero — treat as empty if still stored. */
const OBSOLETE_RENT_GUEST_HERO_COPY =
  'Περιήγηση οχημάτων χωρίς σύνδεση — για κράτηση χρειάζεται είσοδος.';

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

  let copy = guest
    ? String(appearance.rent_guest_hero_copy || '').trim()
    : String(appearance.rent_hero_copy || '').trim() ||
      DEFAULT_RENT_APP_BRANDING.rent_hero_copy;
  if (guest && copy === OBSOLETE_RENT_GUEST_HERO_COPY) copy = '';

  const titleAccent = guest
    ? String(appearance.rent_guest_hero_title_accent || '').trim() ||
      DEFAULT_RENT_APP_BRANDING.rent_guest_hero_title_accent
    : '';

  const cta =
    String(appearance.rent_cta_label || '').trim() ||
    DEFAULT_RENT_APP_BRANDING.rent_cta_label;

  return {
    officeName: office,
    brandLabel: office,
    title,
    titleAccent,
    copy,
    ctaLabel: cta,
    isCustomized: Boolean(
      String(appearance.rent_office_name || '').trim() ||
        String(appearance.rent_hero_title || '').trim() ||
        String(appearance.rent_hero_copy || '').trim(),
    ),
  };
}
