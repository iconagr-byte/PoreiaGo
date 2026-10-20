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
 */
export async function fetchPublicOfficeTrips() {
  try {
    const host = typeof window !== 'undefined' ? window.location.host : '';
    const params = new URLSearchParams();
    if (host) params.set('host', host);
    const tid = getSaasTenantId();
    if (tid) params.set('tenant_id', tid);
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
