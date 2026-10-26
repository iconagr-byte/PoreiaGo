/**
 * Resolve office logo + name for native account splash (Wallet / Driver).
 */

import { resolveOfficeBrand } from '../branding/officeBrand.js';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';

export function resolveOfficeSplashBrand(siteAppearance = {}) {
  const brand = resolveOfficeBrand(siteAppearance || {});
  const logoUrl = brand.hasLogo ? resolveSiteAssetUrl(brand.logoUrl) : '';
  const name = String(brand.displayName || brand.name || '').trim();
  return {
    logoUrl,
    name: name && name !== 'Γραφείο' ? name : '',
    hasLogo: Boolean(logoUrl),
  };
}
