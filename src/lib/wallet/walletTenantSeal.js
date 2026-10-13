/**
 * Client seal: My Wallet session is bound to one office (tenant_id).
 * Never mix bookings/rentals across offices in local caches.
 */

const WALLET_TENANT_KEY = 'wallet_tenant_id';
const SCOPED_CACHE_BASES = ['aerostride_bookings_v1', 'wallet_last_pass_v1'];

export function getWalletTenantId() {
  if (typeof window === 'undefined') return null;
  return (localStorage.getItem(WALLET_TENANT_KEY) || '').trim() || null;
}

/** Drop namespaced wallet caches for a prior office (no cross-office bleed). */
export function clearWalletOfficeCaches(tenantId) {
  if (typeof window === 'undefined' || !tenantId) return;
  const tid = String(tenantId).trim();
  if (!tid) return;
  for (const base of SCOPED_CACHE_BASES) {
    try {
      localStorage.removeItem(`${base}::wallet::${tid}`);
    } catch {
      // ignore quota / private mode
    }
  }
}

export function setWalletTenantId(tenantId) {
  if (typeof window === 'undefined') return;
  const tid = String(tenantId || '').trim();
  const prev = getWalletTenantId();
  if (tid && prev && prev !== tid) {
    clearWalletOfficeCaches(prev);
  }
  if (tid) localStorage.setItem(WALLET_TENANT_KEY, tid);
  else localStorage.removeItem(WALLET_TENANT_KEY);
}

export function clearWalletTenantId() {
  const prev = getWalletTenantId();
  if (prev) clearWalletOfficeCaches(prev);
  setWalletTenantId(null);
}

/** Storage key for customer wallet caches — namespaced by sealed office. */
export function walletOfficeStorageKey(baseKey) {
  const tid = getWalletTenantId();
  if (!tid) return baseKey;
  return `${baseKey}::wallet::${tid}`;
}

export function bookingBelongsToWalletOffice(booking, tenantId = getWalletTenantId()) {
  if (!booking || !tenantId) return false;
  const bid = String(booking.tenant_id || booking.tenantId || '').trim();
  // Strict: unscoped/legacy rows never appear in a sealed wallet.
  if (!bid) return false;
  return bid === tenantId;
}

export function filterBookingsForWalletOffice(bookings, tenantId = getWalletTenantId()) {
  const list = Array.isArray(bookings) ? bookings : [];
  if (!tenantId) return [];
  return list.filter((b) => bookingBelongsToWalletOffice(b, tenantId));
}
