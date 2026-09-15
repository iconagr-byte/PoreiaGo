import { PLATFORM_NAME } from '../marketing/platformCopy.js';
import { isPlatformMarketingHost, isTenantStorefrontHost } from '../platform/tenantHost.js';
import { officeStorageKey } from '../admin/officeTenantStore.js';

const STORAGE_KEY_BASE = 'poreiago_branding_v2';
const LEGACY_STORAGE_KEYS = ['aerostride_branding_v1', 'poreiago_branding_v1', 'poreiago_branding_v2'];

function brandingStorageKey() {
  return officeStorageKey(STORAGE_KEY_BASE);
}

/** Only obsolete platform QA leftovers — never real office names like «Achillio Travel». */
const PLATFORM_PLACEHOLDER_NAME_RE = /^(aerostride|olympus|poreiago)(\s+(travel|platform))?$/i;

/** @deprecated use isPlatformMarketingHost — kept for call sites */
export function isPlatformMarketingContext() {
  if (typeof window === 'undefined') return true;
  return isPlatformMarketingHost(window.location.hostname);
}

/** Known custom-domain offices — never show PoreiaGo in the browser / SERP title. */
export const KNOWN_TENANT_DOCUMENT_TITLES = {
  'achilliotravel.com': 'Achillio Travel',
};

export function platformDocumentTitle() {
  return `${PLATFORM_NAME} — Πλατφόρμα για ταξιδιωτικά γραφεία`;
}

function apexHostname(hostname = '') {
  return String(hostname || (typeof window !== 'undefined' ? window.location.hostname : ''))
    .toLowerCase()
    .replace(/^www\./, '');
}

/** Sync <title> + og/twitter meta so Google never keeps a PoreiaGo SERP on office domains. */
export function syncDocumentMetaTitle(title) {
  const next = String(title || '').trim();
  if (!next || typeof document === 'undefined') return;
  document.title = next;
  const ensureMeta = (attr, key, content) => {
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };
  ensureMeta('property', 'og:title', next);
  ensureMeta('name', 'twitter:title', next);
  ensureMeta('name', 'application-name', next.split('—')[0].trim() || next);
}

/**
 * Browser tab title for an office storefront.
 * Never falls back to PoreiaGo on tenant hosts.
 */
export function tenantDocumentTitle(displayName, hostname = '') {
  const name = String(displayName || '').trim();
  if (name && !PLATFORM_PLACEHOLDER_NAME_RE.test(name)) {
    return name;
  }
  const host = apexHostname(hostname);
  if (KNOWN_TENANT_DOCUMENT_TITLES[host]) {
    return KNOWN_TENANT_DOCUMENT_TITLES[host];
  }
  if (host && !isPlatformMarketingHost(host)) {
    // achilliotravel.com → Achilliotravel (better than PoreiaGo)
    const label = host.split('.')[0] || host;
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  return platformDocumentTitle();
}

function sanitizeDisplayName(name, { allowTenantNames = true } = {}) {
  const trimmed = (name || '').trim();
  if (!trimmed) return '';
  if (PLATFORM_PLACEHOLDER_NAME_RE.test(trimmed)) {
    return allowTenantNames ? '' : PLATFORM_NAME;
  }
  return trimmed;
}

export function sanitizeBranding(branding) {
  if (!branding) return null;
  const onTenant =
    typeof window !== 'undefined' && isTenantStorefrontHost(window.location.hostname);
  return {
    ...branding,
    display_name: sanitizeDisplayName(branding.display_name, { allowTenantNames: onTenant }),
  };
}

export function purgeLegacyBrandingCache() {
  try {
    for (const key of LEGACY_STORAGE_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (PLATFORM_PLACEHOLDER_NAME_RE.test(String(parsed?.display_name || '').trim())) {
          localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }
}

export function cacheBranding(branding) {
  const clean = sanitizeBranding(branding);
  if (!clean) return;
  try {
    localStorage.setItem(brandingStorageKey(), JSON.stringify(clean));
  } catch {
    /* quota */
  }
  applyBrandingToDocument(clean);
}

export function loadCachedBranding() {
  try {
    const raw = localStorage.getItem(brandingStorageKey());
    return raw ? sanitizeBranding(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function applyBrandingToDocument(branding) {
  const clean = sanitizeBranding(branding);
  if (!clean) return;

  const root = document.documentElement;
  if (clean.primary_color) {
    root.style.setProperty('--color-primary', clean.primary_color);
    root.style.setProperty('--primary', clean.primary_color);
  }

  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  if (isTenantStorefrontHost(host) || !isPlatformMarketingHost(host)) {
    syncDocumentMetaTitle(tenantDocumentTitle(clean.display_name, host));
  } else {
    syncDocumentMetaTitle(platformDocumentTitle());
  }

  let styleEl = document.getElementById('tenant-branding-css');
  if (clean.css_injection_inline) {
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'tenant-branding-css';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = clean.css_injection_inline;
  } else if (styleEl) {
    styleEl.remove();
  }

  if (clean.css_injection_url) {
    let linkEl = document.getElementById('tenant-branding-css-link');
    if (!linkEl) {
      linkEl = document.createElement('link');
      linkEl.id = 'tenant-branding-css-link';
      linkEl.rel = 'stylesheet';
      document.head.appendChild(linkEl);
    }
    linkEl.href = clean.css_injection_url;
  }
}
