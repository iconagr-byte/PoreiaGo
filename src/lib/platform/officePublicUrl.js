/**
 * Build public storefront / My Wallet / Rent URLs for the *current office* (tenant).
 *
 * Order: resolve office branding first → then emit absolute customer links.
 * window.location is only a last resort (never overrides a known office host),
 * except the session seal below which prevents cross-office domain bleed in admin QR cards.
 *
 * SEAL: Achillio Travel hosts (*.achilliotravel.com) may only be emitted for the
 * Achillio Travel office. PoreiaGo platform seed (slug=achillio) and every other
 * office must never receive that domain — even if Postgres custom_domain drifted.
 *
 * SESSION SEAL: When the operator is on a PoreiaGo host (*.poreiago.com), never
 * advertise achilliotravel.com in share/QR links — and vice versa on Achillio hosts.
 * Two offices must not mix in dashboard share cards.
 */

import { getPlatformBaseDomain, tenantSubdomainFqdn } from './domain.js';

const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'admin', 'app', 'mail', 'static', 'cdn']);

/** Real Achillio Travel bus office — the only tenant allowed to use achilliotravel.com. */
const ACHILLIO_TRAVEL_SLUGS = new Set([
  'admin-achillio-gr',
  'achillio-travel',
  'achilliotravel',
]);

const ACHILLIO_TRAVEL_HOST_RE = /(^|\.)achilliotravel\.com$/i;
const POREIAGO_HOST_RE = /(^|\.)poreiago\.com$/i;

/** PoreiaGo platform / demo seed — historic slug "achillio" is NOT Achillio Travel. */
const POREIAGO_PLATFORM_SLUGS = new Set([
  'achillio',
  'poreiago',
  'platform',
  'demo',
  'admin-poreiago',
  'poreiago-saas',
  'poreiago-platform',
  'default',
]);

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

export function isAchillioTravelHost(host) {
  const h = stripToHost(host).replace(/^www\./, '');
  return Boolean(h) && ACHILLIO_TRAVEL_HOST_RE.test(h);
}

export function isPoreiagoHost(host) {
  const h = stripToHost(host).replace(/^www\./, '');
  return Boolean(h) && POREIAGO_HOST_RE.test(h);
}

export function isAchillioTravelOfficeBranding(branding = {}) {
  // Only known Achillio Travel office slugs — never infer from a stolen custom_domain.
  const slug = String(branding.slug || branding.subdomain || '')
    .trim()
    .toLowerCase();
  return ACHILLIO_TRAVEL_SLUGS.has(slug);
}

export function isPoreiagoPlatformBranding(branding = {}) {
  const slug = String(branding.slug || branding.subdomain || '')
    .trim()
    .toLowerCase();
  if (POREIAGO_PLATFORM_SLUGS.has(slug)) return true;
  // Only the office custom_domain — never platform_domain (always poreiago.com).
  const domain = stripToHost(branding.custom_domain || '').replace(/^www\./, '');
  return domain === 'poreiago.com' || domain.endsWith('.poreiago.com');
}

/**
 * True when this host must not be used for the given office branding.
 * Blocks Achillio Travel domain bleed onto PoreiaGo / other offices.
 */
export function isForbiddenForeignOfficeHost(host, branding = {}) {
  if (!isAchillioTravelHost(host)) return false;
  if (isAchillioTravelOfficeBranding(branding)) return false;
  return true;
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

function resolveContextHost(explicit) {
  if (explicit != null && String(explicit).trim()) {
    return stripToHost(explicit);
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return stripToHost(window.location.hostname);
  }
  return '';
}

function platformWwwOrigin(branding = {}) {
  const platform = stripToHost(branding.platform_domain || getPlatformBaseDomain()).replace(
    /^www\./,
    '',
  );
  return platform ? `https://www.${platform}` : 'https://www.poreiago.com';
}

/**
 * Safe display name for share cards — never show Achillio Travel on PoreiaGo seed.
 */
export function getOfficeShareDisplayName(branding = {}) {
  const raw = String(branding.display_name || branding.slug || branding.subdomain || '').trim();
  if (isPoreiagoPlatformBranding(branding)) {
    if (!raw || /achillio/i.test(raw)) return 'PoreiaGo';
    return raw;
  }
  return raw || 'Γραφείο';
}

/**
 * Strip Achillio Travel domain fields from non-Achillio branding (client heal).
 * Call before emitting share URLs when API/file data may be poisoned.
 */
export function sanitizeOfficeBrandingForShare(branding = {}) {
  const next = { ...(branding || {}) };
  if (isAchillioTravelOfficeBranding(next)) return next;

  if (isForbiddenForeignOfficeHost(next.custom_domain, next)) {
    next.custom_domain = '';
  }
  const checkout = String(next.checkout_base_url || '').trim();
  if (checkout) {
    try {
      const u = new URL(checkout.includes('://') ? checkout : `https://${checkout}`);
      if (isForbiddenForeignOfficeHost(u.hostname, next)) {
        next.checkout_base_url = platformWwwOrigin(next);
      }
    } catch {
      /* ignore */
    }
  }
  if (isPoreiagoPlatformBranding(next)) {
    const name = String(next.display_name || '').trim();
    if (!name || /achillio/i.test(name)) next.display_name = 'PoreiaGo';
  }
  return next;
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
 * @param {{ contextHost?: string }} [options] — operator browser host (admin share seal)
 */
export function getOfficePublicOrigin(branding = {}, options = {}) {
  const safe = sanitizeOfficeBrandingForShare(branding);
  const platform = stripToHost(safe.platform_domain || getPlatformBaseDomain()).replace(
    /^www\./,
    '',
  );
  const contextHost = resolveContextHost(options.contextHost);

  let origin = '';

  // 1) Office custom domain from tenant branding (this office only).
  const custom = normalizePublicHost(safe.custom_domain);
  if (custom && !isLocalHost(custom) && !isForbiddenForeignOfficeHost(custom, safe)) {
    origin = originFromHost(custom);
  }

  // 2) Office platform subdomain: {slug}.poreiago.com
  // Platform seed slug "achillio" is confusing — prefer www.poreiago.com.
  if (!origin) {
    const sub = String(safe.subdomain || safe.slug || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
    if (isPoreiagoPlatformBranding(safe) && platform) {
      origin = `https://www.${platform}`;
    } else if (sub && !RESERVED_SUBDOMAINS.has(sub)) {
      const fqdn = stripToHost(
        safe.subdomain_fqdn || tenantSubdomainFqdn(sub, platform || getPlatformBaseDomain()),
      );
      if (fqdn && !isLocalHost(fqdn) && !isForbiddenForeignOfficeHost(fqdn, safe)) {
        origin = originFromHost(fqdn);
      }
    }
  }

  // 3) Explicit checkout / public base from branding (skip localhost + foreign hosts).
  if (!origin) {
    const checkout = String(safe.checkout_base_url || '').trim();
    if (checkout) {
      try {
        const u = new URL(checkout.includes('://') ? checkout : `https://${checkout}`);
        if (!isLocalHost(u.hostname) && !isForbiddenForeignOfficeHost(u.hostname, safe)) {
          origin = u.origin;
        }
      } catch {
        /* ignore */
      }
    }
  }

  // 4) Platform ingress for offices without a dedicated public host.
  if (!origin && platform) {
    origin = `https://www.${platform}`;
  }

  // 5) Last resort: current browser origin (local dev).
  if (!origin && typeof window !== 'undefined' && window.location?.origin) {
    origin = window.location.origin;
  }

  // SESSION SEAL — operator host must never advertise the other office's domain.
  if (contextHost && !isLocalHost(contextHost)) {
    if (isPoreiagoHost(contextHost) && isAchillioTravelHost(origin)) {
      return platformWwwOrigin(safe);
    }
    if (isAchillioTravelHost(contextHost)) {
      if (isAchillioTravelOfficeBranding(safe) || isAchillioTravelHost(safe.custom_domain)) {
        return originFromHost(normalizePublicHost(safe.custom_domain || 'achilliotravel.com'));
      }
      if (isAchillioTravelHost(origin)) {
        return platformWwwOrigin(safe);
      }
    }
  }

  return origin || '';
}

export function getOfficeWalletUrl(branding = {}, options = {}) {
  const origin = getOfficePublicOrigin(branding, options).replace(/\/$/, '');
  if (!origin) return '/wallet';
  return `${origin}/wallet`;
}

/** Bus My Wallet login — blue product, separate from Rent. */
export function getOfficeWalletLoginUrl(branding = {}, options = {}) {
  const origin = getOfficePublicOrigin(branding, options).replace(/\/$/, '');
  if (!origin) return '/login';
  return `${origin}/login`;
}

/** Customer rental PWA — absolute URL for QR / share (current office). */
export function getOfficeRentUrl(branding = {}, options = {}) {
  const origin = getOfficePublicOrigin(branding, options).replace(/\/$/, '');
  if (!origin) return '/rent';
  return `${origin}/rent`;
}

/** Rent My Wallet — green product, separate from bus /wallet. */
export function getOfficeRentWalletUrl(branding = {}, options = {}) {
  const origin = getOfficePublicOrigin(branding, options).replace(/\/$/, '');
  if (!origin) return '/rent/wallet';
  return `${origin}/rent/wallet`;
}

/** Rent Wallet login — green auth page. */
export function getOfficeRentLoginUrl(branding = {}, options = {}) {
  const origin = getOfficePublicOrigin(branding, options).replace(/\/$/, '');
  if (!origin) return '/rent/login';
  return `${origin}/rent/login`;
}

export function getOfficeStorefrontUrl(branding = {}, options = {}) {
  const origin = getOfficePublicOrigin(branding, options).replace(/\/$/, '');
  return origin || '/';
}
