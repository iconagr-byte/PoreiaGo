/**
 * Rent customer app branding — office name + hero copy on /rent.
 * Stored on site_appearance; empty fields fall back to office legal name / defaults.
 */

import {
  clampLogoHeight,
  clampLogoMaxWidth,
  clampLogoPadding,
  clampLogoRadius,
  isPlatformPlaceholderLogo,
  normalizeLogoBgMode,
} from '../branding/officeBrand.js';
import {
  RENT_GUEST_HERO_BENEFITS,
  RENT_GUEST_SEARCH_DEFAULTS,
  resolveRentGuestHeroBenefits,
  resolveRentGuestSearchLayout,
} from './rentGuestHero.js';

export const DEFAULT_RENT_APP_BRANDING = {
  rent_office_name: '',
  rent_brand_label: 'Poreiago Rent',
  rent_hero_title: 'Το όχημά σας, σε λίγα βήματα',
  rent_hero_copy:
    'Κράτηση, ημερολόγιο και χάρτης παραλαβής — όλα σε μία σελίδα.',
  rent_guest_hero_title: 'Ενοικίαση αυτοκινήτου',
  rent_guest_hero_title_accent: '— στόλος γραφείου · κράτηση σε λεπτά',
  rent_guest_hero_copy: '',
  rent_guest_hero_benefits: [...RENT_GUEST_HERO_BENEFITS],
  rent_search_show_dropoff_toggle: RENT_GUEST_SEARCH_DEFAULTS.show_dropoff_toggle,
  rent_search_show_promo: RENT_GUEST_SEARCH_DEFAULTS.show_promo,
  rent_search_submit_label: RENT_GUEST_SEARCH_DEFAULTS.submit_label,
  rent_cta_label: 'Βρες όχημα',
};

/** Names that look like empty admin placeholders — never show alone on /rent. */
const GENERIC_OFFICE_LABEL_RE =
  /^(γραφείο|office|το γραφείο|agency|ενοικιάσεις|enoikiaseis|rentals?)$/i;

/** Legacy guest copy removed from /rent hero — treat as empty if still stored. */
const OBSOLETE_RENT_GUEST_HERO_COPY =
  'Περιήγηση οχημάτων χωρίς σύνδεση — για κράτηση χρειάζεται είσοδος.';

/** Previous default accent — refresh to the new platform slogan if still stored. */
const OBSOLETE_RENT_GUEST_HERO_ACCENTS = new Set([
  '— αναζήτησε, σύγκρινε & κλείσε',
  '— αναζήτησε, σύγκρινε & κλείσε.',
]);

export function isGenericRentOfficeLabel(name) {
  return !String(name || '').trim() || GENERIC_OFFICE_LABEL_RE.test(String(name).trim());
}

/** Split «Poreiago Rent» style labels into word + Rent accent. */
export function splitRentBrandLabel(label) {
  const name = String(label || '').trim() || DEFAULT_RENT_APP_BRANDING.rent_brand_label;
  const match = name.match(/^(.*)\s+(Rent)$/i);
  if (match && match[1].trim()) {
    return { primary: match[1].trim(), accent: match[2] };
  }
  return { primary: name, accent: '' };
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

  const office = candidates[0] || DEFAULT_RENT_APP_BRANDING.rent_brand_label;

  // Prefer rent-specific logo so dual offices (buses + rent) can brand /rent alone.
  const rawLogo = appearance.rent_logo_url || appearance.logo_url || '';
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

  // Explicit empty string hides accent; missing / obsolete key keeps the default.
  const rawAccent = appearance.rent_guest_hero_title_accent;
  let titleAccent = '';
  if (guest) {
    if (rawAccent === undefined || rawAccent === null) {
      titleAccent = DEFAULT_RENT_APP_BRANDING.rent_guest_hero_title_accent;
    } else {
      const trimmed = String(rawAccent).trim();
      titleAccent = OBSOLETE_RENT_GUEST_HERO_ACCENTS.has(trimmed)
        ? DEFAULT_RENT_APP_BRANDING.rent_guest_hero_title_accent
        : trimmed;
    }
  }

  const benefits = guest
    ? resolveRentGuestHeroBenefits(appearance.rent_guest_hero_benefits)
    : [];

  const searchLayout = guest
    ? resolveRentGuestSearchLayout(appearance)
    : {
        showDropoffToggle: true,
        showPromo: true,
        submitLabel: RENT_GUEST_SEARCH_DEFAULTS.submit_label,
      };

  const cta =
    String(appearance.rent_cta_label || '').trim() ||
    DEFAULT_RENT_APP_BRANDING.rent_cta_label;

  const showName =
    appearance.rent_logo_show_name !== undefined && appearance.rent_logo_show_name !== null
      ? appearance.rent_logo_show_name !== false
      : appearance.logo_show_name !== false;

  const logoHeightPx = clampLogoHeight(
    appearance.rent_logo_height_px ?? appearance.logo_height_px ?? 40,
  );
  const logoMaxWidthPx = clampLogoMaxWidth(appearance.rent_logo_max_width_px ?? 160);
  const logoRadiusPx = clampLogoRadius(appearance.rent_logo_radius_px ?? 0);
  const logoPaddingPx = clampLogoPadding(appearance.rent_logo_padding_px ?? 0);
  const logoBgMode = normalizeLogoBgMode(appearance.rent_logo_bg_mode ?? 'none');
  const logoShadow = appearance.rent_logo_shadow === true;
  const headerCompact = appearance.rent_header_compact === true;

  return {
    officeName: office,
    brandLabel: office,
    logoUrl,
    showName,
    logoHeightPx,
    logoMaxWidthPx,
    logoRadiusPx,
    logoPaddingPx,
    logoBgMode,
    logoShadow,
    headerCompact,
    /** No subtitle under the wordmark — keeps the header clean. */
    brandSubtitle: '',
    title,
    titleAccent,
    copy,
    benefits,
    searchLayout,
    ctaLabel: cta,
    isCustomized: Boolean(
      String(appearance.rent_office_name || '').trim() ||
        String(appearance.rent_logo_url || '').trim() ||
        String(appearance.rent_hero_title || '').trim() ||
        String(appearance.rent_hero_copy || '').trim(),
    ),
  };
}

function rentLogoBgColor(mode) {
  switch (normalizeLogoBgMode(mode)) {
    case 'white':
      return '#ffffff';
    case 'soft':
      return 'rgba(15, 23, 42, 0.06)';
    case 'dark':
      return 'rgba(15, 23, 42, 0.92)';
    default:
      return 'transparent';
  }
}

/**
 * CSS custom properties for RentBrandMark logo wrap (size + style).
 * @param {ReturnType<typeof resolveRentAppBranding> | object} branding
 */
export function rentBrandMarkStyleVars(branding = {}) {
  const height = clampLogoHeight(branding.logoHeightPx ?? branding.rent_logo_height_px ?? 40);
  const maxWidth = clampLogoMaxWidth(
    branding.logoMaxWidthPx ?? branding.rent_logo_max_width_px ?? 160,
  );
  const radius = clampLogoRadius(branding.logoRadiusPx ?? branding.rent_logo_radius_px ?? 0);
  const padding = clampLogoPadding(
    branding.logoPaddingPx ?? branding.rent_logo_padding_px ?? 0,
  );
  const bgMode = normalizeLogoBgMode(branding.logoBgMode ?? branding.rent_logo_bg_mode ?? 'none');
  const shadow =
    branding.logoShadow === true || branding.rent_logo_shadow === true;
  return {
    ['--rent-logo-h']: `${height}px`,
    ['--rent-logo-max-w']: `${maxWidth}px`,
    ['--rent-logo-radius']: `${radius}px`,
    ['--rent-logo-pad']: `${padding}px`,
    ['--rent-logo-bg']: rentLogoBgColor(bgMode),
    ['--rent-logo-shadow']: shadow ? '0 4px 14px rgba(15, 23, 42, 0.14)' : 'none',
    ['--rent-logo-bg-mode']: bgMode,
  };
}
