import { API_BASE } from '../config/api.js';
import { adminBearerHeaders, adminFetch } from './adminApi.js';
import { getSaasToken, saasFetch } from './saasApi.js';
import { handleAuthFailure, isAuthFailureStatus } from '../lib/authSession.js';
import { HOMEPAGE_LAYOUT_DEFAULTS } from '../lib/homepage/homepageTemplates.js';

const STORAGE_KEY = 'aerostride_site_appearance_v1';

export const DEFAULT_SITE_APPEARANCE = {
  logo_url: '',
  hero_image_url: '/images/hero-bus-achillio.png',
  hero_badge: 'Premium Ταξιδιωτική Εμπειρία',
  hero_title: 'Η Ελλάδα, όπως δεν την έχεις ξαναδεί:',
  hero_title_accent: 'Άνεση, ασφάλεια & θέση εξασφαλισμένη.',
  hero_subtitle:
    'Διάλεξτε από τις προγραμματισμένες εκδρομές μας — χωρίς αναζήτηση προορισμού, μόνο ταξίδια που οργανώνουμε εμείς.',
  hero_search_label: 'Πρόγραμμα εκδρομών',
  footer_brand_name: 'PoreiaGo',
  footer_copyright: '© PoreiaGo. Redefining the journey.',
  footer_privacy_label: 'Privacy Policy',
  footer_privacy_url: '#',
  footer_terms_label: 'Terms of Service',
  footer_terms_url: '#',
  footer_contact_email: '',
  footer_contact_phone: '',
  footer_address: '',
  ...HOMEPAGE_LAYOUT_DEFAULTS,
  updated_at: null,
};

async function parseError(res) {
  const err = await res.json().catch(() => ({}));
  throw new Error(err.detail || res.statusText || 'Request failed');
}

function cacheLocally(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

function loadCached() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SITE_APPEARANCE, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

export { loadCached as loadCachedSiteAppearance };

function mergeAppearance(patch = {}) {
  return { ...DEFAULT_SITE_APPEARANCE, ...loadCached(), ...patch };
}

/** Resolve logo/hero URLs (API assets, static public paths, data URLs). */
export function resolveSiteAssetUrl(url) {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/api/')) {
    return API_BASE ? `${API_BASE}${url}` : url;
  }
  return url;
}

export async function fetchSiteAppearance(host = typeof window !== 'undefined' ? window.location.hostname : '') {
  try {
    const qs = host ? `?host=${encodeURIComponent(host)}` : '';
    const res = await fetch(`${API_BASE}/api/site/appearance${qs}`);
    if (res.ok) {
      const data = await res.json();
      cacheLocally(data);
      return { ...DEFAULT_SITE_APPEARANCE, ...data };
    }
  } catch {
    /* offline */
  }
  return loadCached() || { ...DEFAULT_SITE_APPEARANCE };
}

/** Admin panel — SaaS Postgres when JWT present, else file store. */
export async function fetchAdminSiteAppearance() {
  if (getSaasToken()) {
    try {
      const data = await saasFetch('/api/v1/branding/site-appearance');
      const merged = { ...DEFAULT_SITE_APPEARANCE, ...data };
      cacheLocally(merged);
      return merged;
    } catch {
      /* fall through to file store */
    }
  }
  return fetchSiteAppearance();
}

export async function updateSiteAppearance(patch) {
  const localFallback = mergeAppearance(patch);
  cacheLocally(localFallback);

  if (getSaasToken()) {
    try {
      const data = await saasFetch('/api/v1/branding/site-appearance', {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      const merged = { ...DEFAULT_SITE_APPEARANCE, ...data };
      cacheLocally(merged);
      return { data: merged, source: data.storage_source === 'postgres' ? 'postgres' : 'server', offline: false };
    } catch (saasErr) {
      try {
        const legacy = await updateSiteAppearanceLegacy(patch);
        return legacy;
      } catch {
        throw saasErr;
      }
    }
  }

  return updateSiteAppearanceLegacy(patch);
}

async function updateSiteAppearanceLegacy(patch) {
  const localFallback = mergeAppearance(patch);
  cacheLocally(localFallback);

  try {
    const res = await adminFetch('/api/admin/platform/site-appearance', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = await res.json();
      const merged = { ...DEFAULT_SITE_APPEARANCE, ...data };
      cacheLocally(merged);
      return { data: merged, source: 'server', offline: false };
    }
    if (isAuthFailureStatus(res.status)) {
      handleAuthFailure();
      throw new Error('AUTH_EXPIRED');
    }
    if (res.status >= 500) {
      return { data: localFallback, source: 'local', offline: true };
    }
    await parseError(res);
  } catch (err) {
    if (err.message === 'AUTH_EXPIRED') throw err;
    if (err instanceof TypeError || String(err.message).toLowerCase().includes('fetch')) {
      return { data: localFallback, source: 'local', offline: true };
    }
    throw err;
  }

  return { data: localFallback, source: 'local', offline: true };
}

export async function uploadSiteAsset(kind, file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(
    `${API_BASE}/api/admin/platform/site-appearance/upload/${encodeURIComponent(kind)}`,
    { method: 'POST', headers: adminBearerHeaders(), body: form },
  );
  if (isAuthFailureStatus(res.status)) {
    handleAuthFailure();
    throw new Error('AUTH_EXPIRED');
  }
  if (!res.ok) await parseError(res);
  const data = await res.json();
  if (data.appearance) cacheLocally(data.appearance);
  return data;
}

export async function clearSiteAsset(kind) {
  const res = await adminFetch(
    `/api/admin/platform/site-appearance/upload/${encodeURIComponent(kind)}`,
    { method: 'DELETE' },
  );
  if (isAuthFailureStatus(res.status)) {
    handleAuthFailure();
    throw new Error('AUTH_EXPIRED');
  }
  if (!res.ok) await parseError(res);
  const data = await res.json();
  if (data.appearance) cacheLocally(data.appearance);
  return data;
}
