import { PLATFORM_NAME } from '../marketing/platformCopy.js';

const STORAGE_KEY = 'poreiago_branding_v2';
const LEGACY_STORAGE_KEYS = ['aerostride_branding_v1', 'poreiago_branding_v1'];

const LEGACY_NAME_RE = /achillio|aerostride|olympus/i;

/** Platform marketing — tab title stays PoreiaGo, not tenant QA names. */
export function isPlatformMarketingContext() {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname.toLowerCase();
  const path = window.location.pathname;
  if (host === 'localhost' || host === '127.0.0.1' || host === 'www.poreiago.com' || host === 'poreiago.com') {
    return (
      path === '/' ||
      path.startsWith('/grafeia') ||
      path === '/admin/login' ||
      path === '/login' ||
      path === '/register'
    );
  }
  return false;
}

export function platformDocumentTitle() {
  return `${PLATFORM_NAME} — Travel Operations Platform`;
}

function sanitizeDisplayName(name) {
  const trimmed = (name || '').trim();
  if (!trimmed || LEGACY_NAME_RE.test(trimmed)) {
    return PLATFORM_NAME;
  }
  return trimmed;
}

export function sanitizeBranding(branding) {
  if (!branding) return null;
  return {
    ...branding,
    display_name: sanitizeDisplayName(branding.display_name),
  };
}

export function purgeLegacyBrandingCache() {
  try {
    for (const key of LEGACY_STORAGE_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) {
        continue;
      }
      try {
        const parsed = JSON.parse(raw);
        if (LEGACY_NAME_RE.test(parsed?.display_name || '')) {
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  applyBrandingToDocument(clean);
}

export function loadCachedBranding() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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

  if (!isPlatformMarketingContext()) {
    document.title = clean.display_name.includes('—')
      ? clean.display_name
      : `${clean.display_name} — Travel Operations Platform`;
  } else {
    document.title = platformDocumentTitle();
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
