/**
 * PoreiaGo marketing host / platform seed must never render Achillio Travel branding
 * (leftovers from the shared seed slug=achillio).
 */
import { isPlatformMarketingHost } from '../platform/tenantHost.js';

const ACHILLIO_BRAND_RE = /achillio|achillion/i;

/** Historic platform seed slug — NOT Achillio Travel (that uses admin-achillio-gr). */
const POREIAGO_PLATFORM_SLUGS = new Set([
  'achillio',
  'poreiago',
  'platform',
  'demo',
  'admin-poreiago',
  'poreiago-saas',
  'poreiago-platform',
]);

export function isAchillioTravelBrandText(value) {
  return ACHILLIO_BRAND_RE.test(String(value || '').trim());
}

export function isPoreiagoPlatformTenantSlug(slug) {
  return POREIAGO_PLATFORM_SLUGS.has(String(slug || '').trim().toLowerCase());
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

function isNativeWalletShell() {
  if (typeof document === 'undefined') return false;
  try {
    return document.documentElement?.getAttribute('data-poreiago-app') === 'wallet';
  } catch {
    return false;
  }
}

function isPersistedOfficeLogoUrl(url) {
  const value = String(url || '').trim();
  // Keep server-hosted office uploads. data: URLs on platform seed can still be poison.
  return (
    value.startsWith('/api/site/office-assets/') || value.startsWith('/api/site/assets/')
  );
}

/**
 * Strip Achillio Travel identity from appearance for PoreiaGo hosts / platform seed.
 * @param {object} appearance
 * @param {{ force?: boolean, skipScrub?: boolean }} [opts]
 *   force=true for admin JWT when tenant_slug is platform
 *   skipScrub=true when native Wallet loaded branding via sealed tenant_id
 */
export function scrubAchillioBrandForPlatformHost(appearance = {}, opts = {}) {
  const force = Boolean(opts.force);
  const skipScrub = Boolean(opts.skipScrub);
  const slug = appearance?.tenant_slug;

  // Capacitor My Wallet (localhost) must keep the sealed office logo/name.
  if (!force && (skipScrub || isNativeWalletShell())) {
    return appearance;
  }

  // Real customer offices (incl. Achillio Travel) keep branding even when the
  // admin UI runs on www.poreiago.com — only scrub platform seed / marketing.
  if (!force && slug && !isPoreiagoPlatformTenantSlug(slug)) {
    return appearance;
  }
  const shouldScrub =
    force ||
    isPlatformMarketingHost() ||
    isPoreiagoPlatformTenantSlug(slug);
  if (!shouldScrub) return appearance;

  const next = { ...appearance };
  const brandKeys = ['footer_brand_name', 'rent_office_name', 'display_name', 'footer_copyright'];
  let brandPoisoned = brandKeys.some((key) => isAchillioTravelBrandText(next[key]));

  for (const key of brandKeys) {
    if (isAchillioTravelBrandText(next[key])) {
      next[key] = key === 'footer_copyright' ? '' : 'PoreiaGo';
    }
  }

  const logo = String(next.logo_url || '').trim();
  // Never wipe persisted office uploads (/api/site/...). Scrub other Achillio poison paths.
  if (!isPersistedOfficeLogoUrl(logo) && (isAchillioTravelBrandText(logo) || brandPoisoned)) {
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
