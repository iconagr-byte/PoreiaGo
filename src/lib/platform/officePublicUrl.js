/**
 * Build the public storefront origin / My Wallet URL for the current office tenant.
 */

import { getPlatformBaseDomain, tenantSubdomainFqdn } from './domain.js';

function stripToHost(value) {
  let raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  raw = raw.replace(/^https?:\/\//, '');
  raw = raw.split('/')[0].split('?')[0].replace(/\.$/, '');
  return raw;
}

/**
 * Prefer www.{apex} for custom domains (Traefik ingress), unless already www.
 */
export function normalizePublicHost(host) {
  const h = stripToHost(host);
  if (!h) return '';
  if (h === 'localhost' || h.startsWith('localhost:') || /^\d+\.\d+\.\d+\.\d+/.test(h)) {
    return h;
  }
  const platform = getPlatformBaseDomain();
  if (h === platform || h === `www.${platform}`) return h;
  if (h.endsWith(`.${platform}`)) return h;
  if (h.startsWith('www.')) return h;
  return `www.${h}`;
}

/**
 * @param {{
 *   custom_domain?: string,
 *   subdomain_fqdn?: string,
 *   subdomain?: string,
 *   slug?: string,
 *   platform_domain?: string,
 *   checkout_base_url?: string,
 * }} branding
 */
export function getOfficePublicOrigin(branding = {}) {
  const custom = normalizePublicHost(branding.custom_domain);
  if (custom) {
    const proto = custom.startsWith('localhost') ? 'http' : 'https';
    return `${proto}://${custom}`;
  }

  const fqdn = stripToHost(
    branding.subdomain_fqdn ||
      (branding.subdomain || branding.slug
        ? tenantSubdomainFqdn(
            branding.subdomain || branding.slug,
            branding.platform_domain || getPlatformBaseDomain(),
          )
        : ''),
  );
  if (fqdn) {
    return `https://${fqdn}`;
  }

  const checkout = String(branding.checkout_base_url || '').trim();
  if (checkout) {
    try {
      const u = new URL(checkout.includes('://') ? checkout : `https://${checkout}`);
      return u.origin;
    } catch {
      /* ignore */
    }
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

export function getOfficeWalletUrl(branding = {}) {
  const origin = getOfficePublicOrigin(branding).replace(/\/$/, '');
  if (!origin) return '/wallet';
  return `${origin}/wallet`;
}

/** Customer rental PWA — absolute URL for QR / share. */
export function getOfficeRentUrl(branding = {}) {
  const origin = getOfficePublicOrigin(branding).replace(/\/$/, '');
  if (!origin) return '/rent';
  return `${origin}/rent`;
}

export function getOfficeStorefrontUrl(branding = {}) {
  const origin = getOfficePublicOrigin(branding).replace(/\/$/, '');
  return origin || '/';
}
