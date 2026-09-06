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
