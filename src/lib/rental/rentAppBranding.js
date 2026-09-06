/**
 * Rent customer app branding — office name + hero copy on /rent.
 * Stored on site_appearance; empty fields fall back to office legal name / defaults.
 */

import { isPlatformPlaceholderLogo } from '../branding/officeBrand.js';

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

/** Names that look like empty admin placeholders — never show alone on /rent. */
const GENERIC_OFFICE_LABEL_RE = /^(γραφείο|office|το γραφείο|agency)$/i;

/** Legacy guest copy removed from /rent hero — treat as empty if still stored. */
const OBSOLETE_RENT_GUEST_HERO_COPY =
  'Περιήγηση οχημάτων χωρίς σύνδεση — για κράτηση χρειάζεται είσοδος.';

export function isGenericRentOfficeLabel(name) {
  return !String(name || '').trim() || GENERIC_OFFICE_LABEL_RE.test(String(name).trim());
}

/**
 * @param {object} appearance
 * @param {{ guest?: boolean }} [opts]
 */
export function resolveRentAppBranding(appearance = {}, opts = {}) {
  const guest = Boolean(opts.guest);
  const candidates = [
    appearance.rent_office_name,
    appearance.footer_brand_name,
    appearance.display_name,
  ]
    .map((v) => String(v || '').trim())
    .filter((v) => v && !isGenericRentOfficeLabel(v));

  const office = candidates[0] || 'Ενοικιάσεις';
  const hasRealOfficeName = candidates.length > 0;

  const rawLogo = appearance.logo_url || '';
  const logoUrl = isPlatformPlaceholderLogo(rawLogo) ? '' : String(rawLogo).trim();

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
    logoUrl,
    showName: appearance.logo_show_name !== false,
    /** Secondary chip under the name — only when a real office brand exists. */
    brandSubtitle: hasRealOfficeName ? 'Ενοικιάσεις' : '',
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
