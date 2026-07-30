/**
 * Build public storefront / My Wallet / Rent URLs for the *current office* (tenant).
 *
 * Order: resolve office branding first → then emit absolute customer links.
 * window.location is only a last resort (never overrides a known office host).
 */

import { getPlatformBaseDomain, tenantSubdomainFqdn } from './domain.js';

const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'admin', 'app', 'mail', 'static', 'cdn']);

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

function originFromHost(host) {
  const h = stripToHost(host);
  if (!h) return '';
  const proto = isLocalHost(h) ? 'http' : 'https';
  return `${proto}://${h}`;
}

/**
 * @param {{
 *   custom_domain?: string,
 *   subdomain_fqdn?: string,
 *   subdomain?: string,
 *   slug?: string,
 *   platform_domain?: string,
 *   checkout_base_url?: string,
 *   display_name?: string,
 * }} branding — settings for the JWT / current office tenant
 */
export function getOfficePublicOrigin(branding = {}) {
  const platform = stripToHost(branding.platform_domain || getPlatformBaseDomain()).replace(
    /^www\./,
    '',
  );

  // 1) Office custom domain from tenant branding (this office only).
  const custom = normalizePublicHost(branding.custom_domain);
  if (custom && !isLocalHost(custom)) {
    return originFromHost(custom);
  }

  // 2) Office platform subdomain: {slug}.poreiago.com
  const sub = String(branding.subdomain || branding.slug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  if (sub && !RESERVED_SUBDOMAINS.has(sub)) {
    const fqdn = stripToHost(
      branding.subdomain_fqdn || tenantSubdomainFqdn(sub, platform || getPlatformBaseDomain()),
    );
    if (fqdn && !isLocalHost(fqdn)) {
      return originFromHost(fqdn);
    }
  }

  // 3) Explicit checkout / public base from branding (skip localhost placeholders).
  const checkout = String(branding.checkout_base_url || '').trim();
  if (checkout) {
    try {
      const u = new URL(checkout.includes('://') ? checkout : `https://${checkout}`);
      if (!isLocalHost(u.hostname)) {
        return u.origin;
      }
    } catch {
      /* ignore */
    }
  }

  // 4) Platform ingress for offices without a dedicated public host.
  if (platform) {
    return `https://www.${platform}`;
  }

  // 5) Last resort: current browser origin (local dev).
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

/** Bus My Wallet login — blue product, separate from Rent. */
export function getOfficeWalletLoginUrl(branding = {}) {
  const origin = getOfficePublicOrigin(branding).replace(/\/$/, '');
  if (!origin) return '/login';
  return `${origin}/login`;
}

/** Customer rental PWA — absolute URL for QR / share (current office). */
export function getOfficeRentUrl(branding = {}) {
  const origin = getOfficePublicOrigin(branding).replace(/\/$/, '');
  if (!origin) return '/rent';
  return `${origin}/rent`;
}

/** Rent My Wallet — green product, separate from bus /wallet. */
export function getOfficeRentWalletUrl(branding = {}) {
  const origin = getOfficePublicOrigin(branding).replace(/\/$/, '');
  if (!origin) return '/rent/wallet';
  return `${origin}/rent/wallet`;
}

/** Rent Wallet login — green auth page. */
export function getOfficeRentLoginUrl(branding = {}) {
  const origin = getOfficePublicOrigin(branding).replace(/\/$/, '');
  if (!origin) return '/rent/login';
  return `${origin}/rent/login`;
}

export function getOfficeStorefrontUrl(branding = {}) {
  const origin = getOfficePublicOrigin(branding).replace(/\/$/, '');
  return origin || '/';
}
