/**
 * Session cache of sealed-office published trips for Wallet → seat/checkout.
 * Avoids relying on localStorage tripStore (empty on native localhost).
 */

import { fetchPublicOfficeTrips } from '../../services/officeTripsApi.js';
import { getWalletTenantId } from './walletTenantSeal.js';

const CACHE_KEY = 'wallet_office_trips_v1';

export function rememberWalletOfficeTrips(trips, tenantId = getWalletTenantId()) {
  if (typeof window === 'undefined') return;
  const tid = String(tenantId || '').trim();
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        tenantId: tid || null,
        trips: Array.isArray(trips) ? trips : [],
        at: Date.now(),
      }),
    );
  } catch {
    /* ignore quota */
  }
}

export function getCachedWalletOfficeTrips(tenantId = getWalletTenantId()) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const want = String(tenantId || '').trim();
    const got = String(parsed?.tenantId || '').trim();
    if (want && got && want !== got) return [];
    return Array.isArray(parsed?.trips) ? parsed.trips : [];
  } catch {
    return [];
  }
}

/**
 * Resolve a published office trip for Wallet booking flows.
 * Order: local tripStore → session cache → /api/site/trips (sealed tenant).
 */
export async function resolvePublicOfficeTrip(tripId, tenantId = getWalletTenantId()) {
  const id = Number(tripId);
  if (!Number.isFinite(id) || id <= 0) return null;

  try {
    const { loadTrips } = await import('../trips/tripStore.js');
    const local = loadTrips().find((t) => Number(t.id) === id);
    if (local) return local;
  } catch {
    /* ignore */
  }

  const cached = getCachedWalletOfficeTrips(tenantId);
  const fromCache = cached.find((t) => Number(t.id) === id);
  if (fromCache) return fromCache;

  const tid = String(tenantId || '').trim();
  const list = await fetchPublicOfficeTrips(tid ? { tenantId: tid } : undefined);
  rememberWalletOfficeTrips(list, tid || null);
  return list.find((t) => Number(t.id) === id) || null;
}
