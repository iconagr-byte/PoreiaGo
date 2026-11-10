/**
 * Resolve office logo + name for native account splash (Wallet / Driver).
 * Matches the office seal mark (e.g. Achillio circular A + "Achillio Travel").
 */

import { resolveOfficeBrand } from '../branding/officeBrand.js';
import {
  isAchillioTravelAppearance,
  isAchillioTravelBrandText,
} from '../branding/platformStorefrontGuard.js';
import { isAchillioTravelOfficeBranding } from '../platform/officePublicUrl.js';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';

const ACHILLIO_TRAVEL_NAME = 'Achillio Travel';

function pickOfficeName(siteAppearance = {}, brand = {}) {
  const candidates = [
    brand.displayName,
    brand.name,
    siteAppearance.footer_brand_name,
    siteAppearance.rent_office_name,
    siteAppearance.display_name,
    siteAppearance.office_name,
    siteAppearance.legal_name,
    siteAppearance.brand_name,
  ];
  for (const raw of candidates) {
    const name = String(raw || '').trim();
    if (name && name !== 'Γραφείο') return name;
  }
  const slugish = {
    slug: siteAppearance.tenant_slug || siteAppearance.slug,
    subdomain: siteAppearance.subdomain,
  };
  if (
    isAchillioTravelOfficeBranding(slugish) ||
    isAchillioTravelAppearance(siteAppearance) ||
    isAchillioTravelBrandText(siteAppearance.logo_url)
  ) {
    return ACHILLIO_TRAVEL_NAME;
  }
  return '';
}

export function resolveOfficeSplashBrand(siteAppearance = {}) {
  const appearance = siteAppearance || {};
  const brand = resolveOfficeBrand(appearance);
  const logoUrl = brand.hasLogo ? resolveSiteAssetUrl(brand.logoUrl) : '';
  const name = pickOfficeName(appearance, brand);
  return {
    logoUrl,
    name,
    hasLogo: Boolean(logoUrl),
  };
}
