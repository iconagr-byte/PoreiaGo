import { API_BASE } from '../config/api.js';
import { adminBearerHeaders, adminFetch } from './adminApi.js';
import { getSaasToken, saasFetch } from './saasApi.js';
import { handleAuthFailure, isAuthFailureStatus } from '../lib/authSession.js';
import { HOMEPAGE_LAYOUT_DEFAULTS } from '../lib/homepage/homepageTemplates.js';
import { scrubSiteAppearancePlaceholders } from '../lib/branding/officeBrand.js';
import {
  scrubAchillioBrandForPlatformHost,
} from '../lib/branding/platformStorefrontGuard.js';
import { officeStorageKey } from '../lib/admin/officeTenantStore.js';

// v3: tenant-scoped cache — never reuse Achillio Travel brand across offices.
const STORAGE_KEY_BASE = 'aerostride_site_appearance_v3';

function appearanceStorageKey() {
  return officeStorageKey(STORAGE_KEY_BASE);
}

function finalizeAppearance(data = {}) {
  const merged = scrubSiteAppearancePlaceholders({ ...DEFAULT_SITE_APPEARANCE, ...data });
  // Scrubs Achillio Travel only on PoreiaGo marketing host or platform seed slug.
  return scrubAchillioBrandForPlatformHost(merged);
}

export const DEFAULT_SITE_APPEARANCE = {
  logo_url: '',
  logo_height_px: 40,
  logo_max_width_px: 180,
  logo_show_name: true,
  hero_image_url: '',
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
  rent_coverage_options: [],
  rent_included_defaults: [],
  rent_upsell_coverage_id: '',
  /** Bus trip extras catalog (after seat selection). */
  trip_extra_options: [],
  rent_notify_email_enabled: true,
  rent_notify_sms_enabled: true,
  rent_notify_email_label: 'Θέλω προσφορές στο email',
  rent_notify_sms_label: 'Θέλω ενημερώσεις SMS για την κράτηση',
  rent_notify_email_default: false,
  rent_notify_sms_default: false,
  rent_notify_sms_template_confirmed:
    'Κράτηση {ref} επιβεβαιώθηκε. Παραλαβή: {pickup} · {start}. {office}',
  rent_notify_sms_template_status: 'Κράτηση {ref}: νέα κατάσταση {status}. {office}',
  rent_notify_email_subject: 'Κράτηση {ref} — επιβεβαίωση',
  rent_notify_email_body:
    'Γεια σου {name},<br/><br/>Η κράτησή σου <strong>{ref}</strong> επιβεβαιώθηκε.<br/>Παραλαβή: {pickup}<br/>Έναρξη: {start}<br/><br/>Ευχαριστούμε,<br/>{office}',
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
  let detail = err.detail || res.statusText || 'Request failed';
  if (Array.isArray(detail)) {
    detail = detail.map((d) => d.msg || JSON.stringify(d)).join(', ');
  } else if (typeof detail === 'object' && detail) {
    detail = detail.message || JSON.stringify(detail);
  }
  const raw = String(detail || '').trim();
  if (/internal server error/i.test(raw) || res.status >= 500) {
    throw new Error('Σφάλμα server — δοκιμάστε μικρότερο JPG/PNG ή κάντε επανασύνδεση');
  }
  throw new Error(raw || 'Request failed');
}

function cacheLocally(data) {
  try {
    localStorage.setItem(appearanceStorageKey(), JSON.stringify(finalizeAppearance(data)));
  } catch {
    /* quota */
  }
}

function loadCached() {
  try {
    const raw = localStorage.getItem(appearanceStorageKey());
    return raw ? finalizeAppearance(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export { loadCached as loadCachedSiteAppearance };

function mergeAppearance(patch = {}) {
  return finalizeAppearance({
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
      const merged = finalizeAppearance(data);
      cacheLocally(merged);
      return merged;
    }
  } catch {
    /* offline */
  }
  return loadCached() || finalizeAppearance({});
}

/** Admin panel — SaaS Postgres when JWT present, else file store. */
export async function fetchAdminSiteAppearance() {
  if (getSaasToken()) {
    try {
      const data = await saasFetch('/api/v1/branding/site-appearance');
      const merged = finalizeAppearance(data);
      cacheLocally(merged);
      return merged;
    } catch {
      // Do NOT fall through to host-based fetchSiteAppearance — that would
      // cache PoreiaGo marketing appearance under this office's tenant key.
      return loadCached() || finalizeAppearance({});
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
      // Keep client patch on top — older API schemas may omit layout keys;
      // never let host scrubbers wipe a logo/hero the office just uploaded.
      const merged = finalizeAppearance({ ...data, ...patch });
      if (Object.prototype.hasOwnProperty.call(patch, 'logo_url') && patch.logo_url) {
        merged.logo_url = patch.logo_url;
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'hero_image_url') && patch.hero_image_url) {
        merged.hero_image_url = patch.hero_image_url;
      }
      cacheLocally(merged);
      return { data: merged, source: data.storage_source === 'postgres' ? 'postgres' : 'server', offline: false };
    } catch (saasErr) {
      // Fail closed — never fall through to shared /api/admin/platform/site-appearance
      // (that file is PoreiaGo marketing; Achillio must not overwrite it).
      throw saasErr;
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
  // SaaS / office tenants: multipart upload to tenant-scoped disk + short URL
  // in Postgres. Data URLs in settings_json caused 500s on large logos.
  if (getSaasToken()) {
    const form = new FormData();
    form.append('file', file);
    const res = await adminFetch(
      `/api/v1/branding/site-appearance/upload/${encodeURIComponent(kind)}`,
      { method: 'POST', body: form, retries: 3 },
    );
    if (isAuthFailureStatus(res.status)) {
      handleAuthFailure();
      throw new Error('AUTH_EXPIRED');
    }
    if (!res.ok) await parseError(res);
    const data = await res.json();
    if (data.appearance) {
      const merged = finalizeAppearance(data.appearance);
      if (data.url) {
        const key = kind === 'logo' ? 'logo_url' : 'hero_image_url';
        merged[key] = data.url;
      }
      cacheLocally(merged);
      return { ...data, appearance: merged };
    }
    return data;
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
    const res = await adminFetch(
      `/api/v1/branding/site-appearance/upload/${encodeURIComponent(kind)}`,
      { method: 'DELETE', retries: 3 },
    );
    if (isAuthFailureStatus(res.status)) {
      handleAuthFailure();
      throw new Error('AUTH_EXPIRED');
    }
    if (!res.ok) await parseError(res);
    const data = await res.json();
    if (data.appearance) {
      const merged = finalizeAppearance(data.appearance);
      cacheLocally(merged);
      return { ok: true, appearance: merged };
    }
    return { ok: true, appearance: data.appearance };
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
