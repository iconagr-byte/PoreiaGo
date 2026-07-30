import { API_BASE } from '../config/api.js';
import { adminBearerHeaders, adminFetch } from './adminApi.js';
import { getSaasToken, saasFetch } from './saasApi.js';
import { handleAuthFailure, isAuthFailureStatus } from '../lib/authSession.js';
import { HOMEPAGE_LAYOUT_DEFAULTS } from '../lib/homepage/homepageTemplates.js';
import { scrubSiteAppearancePlaceholders } from '../lib/branding/officeBrand.js';
import { fileToLogoDataUrl } from '../lib/branding/logoImage.js';
import { fileToTripCoverDataUrl } from '../lib/trips/tripImage.js';

// v2: drop cached Achillion Travel logo that was incorrectly served on PoreiaGo.
const STORAGE_KEY = 'aerostride_site_appearance_v2';

export const DEFAULT_SITE_APPEARANCE = {
  logo_url: '',
  logo_height_px: 40,
  logo_max_width_px: 180,
  logo_show_name: true,
  hero_image_url: '/images/hero-bus-achillio.png',
  hero_image_focal: 'center',
  hero_badge: 'Premium Ταξιδιωτική Εμπειρία',
  hero_title: 'Η Ελλάδα, όπως δεν την έχεις ξαναδεί:',
  hero_title_accent: 'Άνεση, ασφάλεια & θέση εξασφαλισμένη.',
  hero_subtitle:
    'Διάλεξτε από τις προγραμματισμένες εκδρομές μας — χωρίς αναζήτηση προορισμού, μόνο ταξίδια που οργανώνουμε εμείς.',
  hero_search_label: 'Πρόγραμμα εκδρομών',
  footer_brand_name: '',
  footer_copyright: '',
  footer_privacy_label: 'Πολιτική Απορρήτου',
  footer_privacy_url: '#',
  footer_terms_label: 'Όροι Χρήσης',
  footer_terms_url: '#',
  footer_contact_email: '',
  footer_contact_phone: '',
  footer_address: '',
  rent_office_name: '',
  rent_hero_title: 'Το όχημά σας, σε λίγα βήματα',
  rent_hero_copy:
    'Κράτηση, ημερολόγιο και χάρτης παραλαβής — όλα σε μία σελίδα.',
  rent_guest_hero_title: 'Δες τον στόλο πριν κλείσεις',
  rent_guest_hero_copy: '',
  rent_cta_label: 'Βρες όχημα',
  rent_pickup_locations: [],
  home_slider_enabled: false,
  home_slider_autoplay: true,
  home_slider_interval_sec: 5,
  home_slider_options: {},
  home_slider_slides: [],
  rent_slider_enabled: false,
  rent_slider_autoplay: true,
  rent_slider_interval_sec: 5,
  rent_slider_options: {},
  rent_slider_slides: [],
  ...HOMEPAGE_LAYOUT_DEFAULTS,
  updated_at: null,
};

async function parseError(res) {
  const err = await res.json().catch(() => ({}));
  throw new Error(err.detail || res.statusText || 'Request failed');
}

function cacheLocally(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scrubSiteAppearancePlaceholders(data)));
  } catch {
    /* quota */
  }
}

function loadCached() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw
      ? scrubSiteAppearancePlaceholders({ ...DEFAULT_SITE_APPEARANCE, ...JSON.parse(raw) })
      : null;
  } catch {
    return null;
  }
}

export { loadCached as loadCachedSiteAppearance };

function mergeAppearance(patch = {}) {
  return scrubSiteAppearancePlaceholders({
    ...DEFAULT_SITE_APPEARANCE,
    ...loadCached(),
    ...patch,
  });
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
      const merged = scrubSiteAppearancePlaceholders({ ...DEFAULT_SITE_APPEARANCE, ...data });
      cacheLocally(merged);
      return merged;
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
      const merged = scrubSiteAppearancePlaceholders({ ...DEFAULT_SITE_APPEARANCE, ...data });
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
      const merged = scrubSiteAppearancePlaceholders({ ...DEFAULT_SITE_APPEARANCE, ...data });
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
  // SaaS / office tenants: persist logo in Postgres site_appearance so the
  // storefront (host-resolved) actually receives it. File-store upload alone
  // only updates the shared platform JSON and was invisible on office sites.
  if (getSaasToken()) {
    const url =
      kind === 'hero' ? await fileToTripCoverDataUrl(file) : await fileToLogoDataUrl(file);
    const key = kind === 'logo' ? 'logo_url' : 'hero_image_url';
    const saved = await updateSiteAppearance({ [key]: url });
    return {
      ok: true,
      kind,
      url,
      appearance: saved.data,
    };
  }

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
  if (getSaasToken()) {
    const key = kind === 'logo' ? 'logo_url' : 'hero_image_url';
    const value = kind === 'logo' ? '' : DEFAULT_SITE_APPEARANCE.hero_image_url;
    const saved = await updateSiteAppearance({ [key]: value });
    return { ok: true, appearance: saved.data };
  }

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
