import { API_BASE } from '../config/api.js';
import { adminFetch } from './adminApi.js';
import { getSaasToken, saasFetch } from './saasApi.js';
import {
  DEFAULT_INGRESS_CNAME,
  getPlatformBaseDomain,
  tenantSubdomainFqdn,
} from '../lib/platform/domain.js';

const BASE_DOMAIN = getPlatformBaseDomain();
const DEFAULT_DNS = {
  cname_host: '',
  cname_target: DEFAULT_INGRESS_CNAME,
  notes: [],
};

async function parseError(res) {
  const err = await res.json().catch(() => ({}));
  let detail = err.detail ?? res.statusText ?? 'Request failed';
  if (Array.isArray(detail)) {
    detail = detail.map((d) => d.msg || JSON.stringify(d)).join(', ');
  } else if (typeof detail === 'object') {
    detail = JSON.stringify(detail);
  }
  throw new Error(String(detail));
}

function normalizeBrandingResponse(data, source = 'postgres') {
  // Never invent another office's slug (old default "achillio" poisoned share URLs).
  const subdomain = String(data.subdomain || data.slug || '')
    .trim()
    .toLowerCase();
  const platformDomain = data.platform_domain || BASE_DOMAIN;
  const slug = String(data.slug || subdomain || '')
    .trim()
    .toLowerCase();
  const achillioTravelSlugs = new Set([
    'admin-achillio-gr',
    'achillio-travel',
    'achilliotravel',
  ]);
  const poreiagoSlugs = new Set([
    'achillio',
    'poreiago',
    'platform',
    'demo',
    'admin-poreiago',
    'poreiago-saas',
    'poreiago-platform',
    'default',
  ]);
  let customDomain = String(data.custom_domain || '').trim();
  let checkoutBase = String(data.checkout_base_url || '').trim();
  let displayName = String(data.display_name || '').trim();
  const isAchillioTravel = achillioTravelSlugs.has(slug);
  const isPoreiago = poreiagoSlugs.has(slug);
  const achillioHost = /(^|\.)achilliotravel\.com$/i;

  // Client heal: Achillio Travel domain belongs only to Achillio Travel office.
  if (!isAchillioTravel) {
    const customHost = customDomain
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .replace(/^www\./, '');
    if (customHost && achillioHost.test(customHost)) {
      customDomain = '';
    }
    try {
      if (checkoutBase) {
        const u = new URL(
          checkoutBase.includes('://') ? checkoutBase : `https://${checkoutBase}`,
        );
        if (achillioHost.test(u.hostname.replace(/^www\./, '') || u.hostname)) {
          checkoutBase = `https://www.${platformDomain}`;
        }
      }
    } catch {
      /* ignore */
    }
  }
  if (isPoreiago && (!displayName || /achillio/i.test(displayName))) {
    displayName = 'PoreiaGo';
  }

  return {
    display_name: displayName,
    slug: data.slug || subdomain || '',
    subdomain,
    platform_domain: platformDomain,
    subdomain_fqdn:
      data.subdomain_fqdn ||
      (subdomain ? tenantSubdomainFqdn(subdomain, platformDomain) : ''),
    custom_domain: customDomain,
    primary_color: data.primary_color || '#0040df',
    logo_url: data.logo_url || '',
    css_injection_url: data.css_injection_url || '',
    css_injection_inline: data.css_injection_inline || '',
    checkout_base_url: checkoutBase,
    dns_instructions: data.dns_instructions || DEFAULT_DNS,
    storage_source: source,
  };
}

export async function fetchBranding(host) {
  const q = host ? `?host=${encodeURIComponent(host)}` : '';
  const res = await fetch(`${API_BASE}/api/branding/current${q}`);
  if (!res.ok) await parseError(res);
  return res.json();
}

/** Tenant branding — Postgres tenants.custom_domain (preferred when SaaS JWT). */
export async function fetchTenantBrandingSettings() {
  if (getSaasToken()) {
    try {
      const data = await saasFetch('/api/v1/branding/settings');
      return normalizeBrandingResponse(data, 'postgres');
    } catch {
      // Stale JWT, Postgres down, or tenant not seeded — fall back to file store
    }
  }
  const legacy = await fetchAdminBrandingLegacy();
  return normalizeBrandingResponse(legacy, 'file');
}

export async function updateTenantBrandingSettings(payload) {
  if (getSaasToken()) {
    try {
      const data = await saasFetch('/api/v1/branding/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      return normalizeBrandingResponse(data, data.storage_source === 'file' ? 'file' : 'postgres');
    } catch (saasErr) {
      try {
        const legacy = await updateAdminBrandingLegacy(payload);
        return normalizeBrandingResponse(legacy, 'file');
      } catch {
        throw saasErr;
      }
    }
  }
  const legacy = await updateAdminBrandingLegacy(payload);
  return normalizeBrandingResponse(legacy, 'file');
}

/** @deprecated — use fetchTenantBrandingSettings */
export async function fetchAdminBranding() {
  return fetchTenantBrandingSettings();
}

/** @deprecated — use updateTenantBrandingSettings */
export async function updateAdminBranding(payload) {
  return updateTenantBrandingSettings(payload);
}

async function fetchAdminBrandingLegacy() {
  const res = await adminFetch('/api/admin/platform/branding');
  if (!res.ok) await parseError(res);
  return res.json();
}

async function updateAdminBrandingLegacy(payload) {
  const res = await adminFetch('/api/admin/platform/branding', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function fetchPartnerWebhooks() {
  const res = await adminFetch('/api/admin/platform/partners/webhooks');
  if (!res.ok) return [];
  return res.json();
}

export async function createPartnerWebhook(payload) {
  const res = await adminFetch('/api/admin/platform/partners/webhooks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function deletePartnerWebhook(subId) {
  const res = await adminFetch(`/api/admin/platform/partners/webhooks/${subId}`, {
    method: 'DELETE',
  });
  if (!res.ok) await parseError(res);
}

export async function dispatchPartnerEvent(eventType, payload) {
  try {
    const res = await adminFetch('/api/admin/platform/partners/dispatch', {
      method: 'POST',
      body: JSON.stringify({ event_type: eventType, payload }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
