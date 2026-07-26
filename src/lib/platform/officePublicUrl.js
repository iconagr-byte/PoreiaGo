/**
 * Build the public storefront origin / My Wallet / Rent URL for the current office.
 *
 * Prefer the host where the office app is actually open (window.location), so admin
 * QR/share links match the live site (e.g. www.poreiago.com) instead of a stale
 * custom_domain from another brand.
 */

import { getPlatformBaseDomain, tenantSubdomainFqdn } from './domain.js';

function stripToHost(value) {
  let raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  raw = raw.replace(/^https?:\/\//, '');
  raw = raw.split('/')[0].split('?')[0].replace(/\.$/, '');
  return raw;
}

function isLocalHost(host) {
  const h = stripToHost(host);
  if (!h) return true;
  if (h === 'localhost' || h.startsWith('localhost:')) return true;
  if (/^\d+\.\d+\.\d+\.\d+/.test(h)) return true;
  return false;
}

/**
 * Prefer www.{apex} for custom domains (Traefik ingress), unless already www.
 */
export function normalizePublicHost(host) {
  const h = stripToHost(host);
  if (!h) return '';
  if (isLocalHost(h)) return h;
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
  // 1) Where the office is open right now (production / custom domain host).
  if (typeof window !== 'undefined' && window.location?.origin) {
    const host = stripToHost(window.location.host);
    if (!isLocalHost(host)) {
      return window.location.origin;
    }
  }

  // 2) Branding custom domain (useful on localhost / offline tooling).
  const custom = normalizePublicHost(branding.custom_domain);
  if (custom) {
    const proto = isLocalHost(custom) ? 'http' : 'https';
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
