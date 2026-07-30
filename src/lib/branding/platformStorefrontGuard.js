/**
 * PoreiaGo marketing host must never render a white-label office storefront
 * (especially Achillio Travel leftovers from the shared seed / preview cache).
 */
import { isPlatformMarketingHost } from '../platform/tenantHost.js';

const ACHILLIO_BRAND_RE = /achillio|achillion/i;

export function isAchillioTravelBrandText(value) {
  return ACHILLIO_BRAND_RE.test(String(value || '').trim());
}

export function isAchillioTravelAppearance(appearance = {}) {
  const fields = [
    appearance.footer_brand_name,
    appearance.rent_office_name,
    appearance.display_name,
    appearance.footer_copyright,
    appearance.logo_url,
    appearance.hero_image_url,
  ];
  return fields.some((v) => isAchillioTravelBrandText(v));
}

/**
 * Strip Achillio Travel identity from appearance when rendering on PoreiaGo host.
 * Keeps layout/copy that is not brand-specific; replaces names with PoreiaGo.
 */
export function scrubAchillioBrandForPlatformHost(appearance = {}) {
  if (!isPlatformMarketingHost()) return appearance;
  const next = { ...appearance };
  for (const key of [
    'footer_brand_name',
    'rent_office_name',
    'display_name',
    'footer_copyright',
  ]) {
    if (isAchillioTravelBrandText(next[key])) {
      next[key] = key === 'footer_copyright' ? '' : 'PoreiaGo';
    }
  }
  if (isAchillioTravelBrandText(next.logo_url)) {
    next.logo_url = '';
  }
  // Shared demo hero filename still reads as Achillio — use empty (CSS/hero fallback).
  if (isAchillioTravelBrandText(next.hero_image_url)) {
    next.hero_image_url = '';
  }
  return next;
}

/** True when /storefront must not render on this host. */
export function shouldBlockStorefrontOnHost(hostname) {
  return isPlatformMarketingHost(hostname);
}
