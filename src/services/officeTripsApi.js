import { API_BASE, getApiBase } from '../config/api.js';
import { normalizeTrip } from '../lib/trips/tripMarket.js';
import { getSaasTenantId, getSaasToken } from './saasApi.js';

function apiBase() {
  try {
    return getApiBase() || API_BASE || '';
  } catch {
    return API_BASE || '';
  }
}

/**
 * Published trips for the current office Host (tenant-scoped).
 * Never falls back to shared mock / localStorage catalogs.
 *
 * When Back Office runs on a marketing host (poreiago.com) but the JWT is an
 * office session, send Bearer + tenant_id so hydrate can merge storefront seeds
 * into Διαχείριση Εκδρομών.
 *
 * Native / sealed Wallet: pass `{ tenantId }` (Host may be localhost or a
 * broken proxy Host). Always also send browser `host` when available so
 * DomainResolver still works if tenant_id is missing.
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
      const sealed = getWalletTenantId();
      // Sealed My Wallet office — native localhost, marketing host, or
      // desktop on the office domain (Achillio). Published catalog only.
      if (sealed) tenantId = sealed;
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
    // Prefer sealed tenant_id (API honors it for published catalogs).
    // Always include browser host too — NPM often rewrites Request Host to
    // 127.0.0.1, so ?host=www.achilliotravel.com is the reliable fallback.
    if (tenantId) params.set('tenant_id', tenantId);
    if (effectiveHost) params.set('host', effectiveHost);
    const qs = params.toString() ? `?${params}` : '';
    const headers = {};
    const token = getSaasToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${apiBase()}/api/site/trips${qs}`, { headers });
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
