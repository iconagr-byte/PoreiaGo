import { API_BASE } from '../config/api.js';
import { normalizeTrip } from '../lib/trips/tripMarket.js';
import { getSaasTenantId, getSaasToken } from './saasApi.js';

/**
 * Published trips for the current office Host (tenant-scoped).
 * Never falls back to shared mock / localStorage catalogs.
 *
 * When Back Office runs on a marketing host (poreiago.com) but the JWT is an
 * office session, send Bearer + tenant_id so hydrate can merge storefront seeds
 * into Διαχείριση Εκδρομών (API ignores tenant_id unless JWT matches).
 *
 * Native / sealed Wallet: pass `{ tenantId }` (Host is localhost).
 *
 * @param {string | { host?: string, tenantId?: string }} [hostOrOpts]
 */
export async function fetchPublicOfficeTrips(hostOrOpts) {
  let effectiveHost =
    typeof hostOrOpts === 'string' ? hostOrOpts : String(hostOrOpts?.host || '');
  if (!effectiveHost && typeof window !== 'undefined') {
    effectiveHost = window.location.host || window.location.hostname || '';
  }
  let tenantId =
    typeof hostOrOpts === 'object' && hostOrOpts
      ? String(hostOrOpts.tenantId || '').trim()
      : '';

  if (!tenantId) {
    try {
      const { getWalletTenantId } = await import('../lib/wallet/walletTenantSeal.js');
      const { isNativeApp } = await import('../lib/capacitor/isNativeApp.js');
      const { isPlatformMarketingHost } = await import('../lib/platform/tenantHost.js');
      const sealed = getWalletTenantId();
      const hostOnly = String(effectiveHost || '')
        .split(':')[0]
        .toLowerCase();
      if (sealed && (isNativeApp() || isPlatformMarketingHost(hostOnly))) {
        tenantId = sealed;
      }
    } catch {
      /* ignore */
    }
  }

  if (!tenantId) {
    const saasTid = getSaasTenantId();
    if (saasTid) tenantId = String(saasTid).trim();
  }

  try {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenant_id', tenantId);
    else if (effectiveHost) params.set('host', effectiveHost);
    const qs = params.toString() ? `?${params}` : '';
    const headers = {};
    const token = getSaasToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/api/site/trips${qs}`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map((t) => normalizeTrip(t));
      }
    }
  } catch {
    /* offline / API down — empty list (never bleed another office) */
  }
  return [];
}
