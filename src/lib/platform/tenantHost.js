/**
 * Detect whether the current hostname is the PoreiaGo marketing site
 * or a tenant office storefront (custom domain / slug.poreiago.com).
 */
import { getPlatformBaseDomain } from './domain.js';

const PLATFORM_APEX_HOSTS = new Set([
  'www.poreiago.com',
  'poreiago.com',
  'localhost',
  '127.0.0.1',
]);

export function currentHostname() {
  if (typeof window === 'undefined') return '';
  return String(window.location.hostname || '').toLowerCase().split(':')[0];
}

/** Achillio Travel custom domain — bus-only, never Rent storefront. */
export function isAchillioTravelHost(hostname = currentHostname()) {
  const host = String(hostname || '').toLowerCase().split(':')[0];
  const apex = host.replace(/^www\./, '');
  return apex === 'achilliotravel.com' || host.endsWith('.achilliotravel.com');
}

/** True on the SaaS marketing host (not a tenant white-label site). */
export function isPlatformMarketingHost(hostname = currentHostname()) {
  const host = String(hostname || '').toLowerCase();
  if (!host || PLATFORM_APEX_HOSTS.has(host)) return true;

  const base = getPlatformBaseDomain();
  // Bare platform apex already covered; tenant subdomains are NOT marketing.
  if (host === base || host === `www.${base}` || host === `api.${base}`) return true;
  return false;
}

/**
 * True when visitors should see the office storefront on `/`
 * (custom domain or {slug}.poreiago.com).
 */
export function isTenantStorefrontHost(hostname = currentHostname()) {
  const host = String(hostname || '').toLowerCase();
  if (!host || isPlatformMarketingHost(host)) return false;

  const base = getPlatformBaseDomain();
  if (host.endsWith(`.${base}`)) {
    const sub = host.slice(0, -(base.length + 1));
    // Only single-label office subdomains: demo.poreiago.com (not www/api/admin).
    if (!sub || sub.includes('.') || sub === 'www' || sub === 'api' || sub === 'admin') {
      return false;
    }
    return true;
  }

  // Any other hostname (e.g. www.achilliotravel.com) is a tenant custom domain.
  return true;
}

/** Single-label office subdomain on the platform base domain, or ''. */
export function platformOfficeSubdomain(hostname = currentHostname()) {
  const host = String(hostname || '').toLowerCase().split(':')[0];
  const base = getPlatformBaseDomain();
  if (!host || !host.endsWith(`.${base}`)) return '';
  const sub = host.slice(0, -(base.length + 1));
  if (!sub || sub.includes('.') || sub === 'www' || sub === 'api' || sub === 'admin') {
    return '';
  }
  return sub;
}

/**
 * When Host is slugify(legal_name).poreiago.com but the office lives on
 * {tenant_slug}.poreiago.com, bounce to the canonical subdomain (keep path/query).
 * @returns {boolean} true when a redirect was started
 */
export function redirectToCanonicalOfficeHost(tenantSlug, hostname = currentHostname()) {
  const slug = String(tenantSlug || '').trim().toLowerCase();
  if (!slug || typeof window === 'undefined') return false;
  const current = platformOfficeSubdomain(hostname);
  if (!current || current === slug) return false;
  const base = getPlatformBaseDomain();
  const next = `https://${slug}.${base}${window.location.pathname || '/'}${window.location.search || ''}${window.location.hash || ''}`;
  window.location.replace(next);
  return true;
}
