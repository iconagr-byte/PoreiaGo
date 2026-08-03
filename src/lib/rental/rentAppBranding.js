/**
 * Rent customer app branding — office name + hero copy on /rent.
 * Stored on site_appearance; empty fields fall back to office legal name / defaults.
 */

export const DEFAULT_RENT_APP_BRANDING = {
  rent_office_name: '',
  rent_hero_title: 'Το όχημά σας, με πραγματικά οφέλη',
  rent_hero_copy:
    'Σύγκρινε μοντέλα, κλείσε online και πάρε χάρτη παραλαβής, ασφάλεια και υποστήριξη — όλα στο Wallet σου.',
  /** Customer-facing line above the hero title (never a bare «Γραφείο»). */
  rent_hero_kicker: 'Επωφελήσου από την ενοικίαση',
  rent_guest_hero_title: 'Ενοικίαση αυτοκινήτου & van',
  rent_guest_hero_title_accent: 'για όλο το ταξίδι σας',
  rent_guest_hero_copy: '',
  rent_cta_label: 'Βρες όχημα',
};

/** Legacy guest copy removed from /rent hero — treat as empty if still stored. */
const OBSOLETE_RENT_GUEST_HERO_COPY =
  'Περιήγηση οχημάτων χωρίς σύνδεση — για κράτηση χρειάζεται είσοδος.';

/** Generic labels that should not headline the customer-facing hero. */
const GENERIC_OFFICE_LABEL =
  /^(γραφείο|γραφειο|ενοικίαση|ενοικιαση|office|rent|rent wallet|my wallet)$/i;

export function isGenericRentOfficeLabel(label) {
  return !String(label || '').trim() || GENERIC_OFFICE_LABEL.test(String(label).trim());
}

/**
 * @param {object} appearance
 * @param {{ guest?: boolean }} [opts]
 */
export function resolveRentAppBranding(appearance = {}, opts = {}) {
  const guest = Boolean(opts.guest);
  const officeRaw =
    String(appearance.rent_office_name || '').trim() ||
    String(appearance.footer_brand_name || '').trim() ||
    String(appearance.display_name || '').trim() ||
    '';

  const office = isGenericRentOfficeLabel(officeRaw) ? 'Ενοικίαση' : officeRaw;

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

  // Hero always speaks to the customer about rental benefits — not «Γραφείο».
  const heroKicker =
    String(appearance.rent_hero_kicker || '').trim() ||
    DEFAULT_RENT_APP_BRANDING.rent_hero_kicker;

  return {
    officeName: office,
    brandLabel: office,
    /** Customer-facing line above the hero title. */
    heroKicker,
    title,
    titleAccent,
    copy,
    ctaLabel: cta,
    isCustomized: Boolean(
      String(appearance.rent_office_name || '').trim() ||
        String(appearance.rent_hero_title || '').trim() ||
        String(appearance.rent_hero_copy || '').trim() ||
        String(appearance.rent_hero_kicker || '').trim(),
    ),
  };
}
