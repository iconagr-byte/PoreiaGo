/**
 * Resolve office logo + name for native account splash (Wallet / Driver).
 * Matches the office seal mark (e.g. Achillio circular A + "Achillio Travel").
 */

import { resolveOfficeBrand } from '../branding/officeBrand.js';
import {
  isAchillioTravelAppearance,
  isAchillioTravelBrandText,
} from '../branding/platformStorefrontGuard.js';
import {
  isAchillioTravelHost,
  isAchillioTravelOfficeBranding,
} from '../platform/officePublicUrl.js';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';

export const ACHILLIO_TRAVEL_NAME = 'Achillio Travel';

function firstNonEmpty(...values) {
  for (const raw of values) {
    const name = String(raw || '').trim();
    if (name && name !== 'Γραφείο' && name !== 'My Wallet' && name !== 'PoreiaGo') {
      return name;
    }
  }
  return '';
}

/** True when sealed appearance / host points at Achillio Travel (not PoreiaGo seed). */
export function isAchillioTravelSplashBrand(siteAppearance = {}) {
  const appearance = siteAppearance || {};
  const slugish = {
    slug: appearance.tenant_slug || appearance.slug,
    subdomain: appearance.subdomain,
  };
  if (isAchillioTravelOfficeBranding(slugish)) return true;
  if (isAchillioTravelAppearance(appearance)) return true;

  const domainHints = [
    appearance.custom_domain,
    appearance.public_domain,
    appearance.office_domain,
    appearance.platform_domain,
    appearance.logo_url,
    appearance.footer_brand_name,
    appearance.rent_office_name,
    appearance.display_name,
  ];
  if (domainHints.some((v) => isAchillioTravelBrandText(v))) return true;
  if (domainHints.some((v) => isAchillioTravelHost(v))) return true;

  // Native Capacitor builds for Achillio default API host to achilliotravel.com.
  try {
    if (typeof window !== 'undefined') {
      const apiBase = String(window.__POREIAGO_API_BASE__ || '').trim();
      if (isAchillioTravelHost(apiBase) || isAchillioTravelBrandText(apiBase)) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function pickOfficeName(siteAppearance = {}, brand = {}) {
  const appearance = siteAppearance || {};
  const fromFields = firstNonEmpty(
    brand.displayName,
    brand.name,
    appearance.footer_brand_name,
    appearance.rent_office_name,
    appearance.display_name,
    appearance.office_name,
    appearance.legal_name,
    appearance.brand_name,
  );
  if (fromFields) return fromFields;
  if (isAchillioTravelSplashBrand(appearance)) return ACHILLIO_TRAVEL_NAME;
  return '';
}

export function resolveOfficeSplashBrand(siteAppearance = {}) {
  const appearance = siteAppearance || {};
  const brand = resolveOfficeBrand(appearance);
  const logoUrl = brand.hasLogo ? resolveSiteAssetUrl(brand.logoUrl) : '';
  let name = pickOfficeName(appearance, brand);

  // Native seal: never show logo-only — wordmark must sit beside the circular mark.
  if (!name && logoUrl && isAchillioTravelSplashBrand(appearance)) {
    name = ACHILLIO_TRAVEL_NAME;
  }
  // Last resort when Achillio circular seal is present without name fields
  // (cache race / older appearance rows): still paint the wordmark.
  if (!name && logoUrl && isAchillioTravelBrandText(appearance.logo_url || logoUrl)) {
    name = ACHILLIO_TRAVEL_NAME;
  }

  return {
    logoUrl,
    name,
    hasLogo: Boolean(logoUrl),
  };
}
