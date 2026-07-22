/**
 * Tenant-scoped office data — new offices must not inherit demo/mock data
 * from another tenant on the same browser.
 */

const TOKEN_KEY = 'saas_access_token';
const TENANT_KEY = 'saas_tenant_id';

const LEGACY_KEYS = [
  'aerostride_customers_v1',
  'aerostride_trips_v1',
  'aerostride_bookings_v1',
];

/** True when BackOffice is using a SaaS JWT (real office session). */
export function isAuthenticatedOfficeSession() {
  try {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  } catch {
    return false;
  }
}

export function currentOfficeTenantKey() {
  try {
    const tid = (localStorage.getItem(TENANT_KEY) || '').trim();
    return tid || 'anonymous';
  } catch {
    return 'anonymous';
  }
}

/** Storage key namespaced by tenant id. */
export function officeStorageKey(baseKey) {
  if (!isAuthenticatedOfficeSession()) return baseKey;
  return `${baseKey}::${currentOfficeTenantKey()}`;
}

/**
 * Call after login / tenant switch so a new office never reuses another
 * tenant's cached customers / trips / bookings in the same browser.
 */
export function resetOfficeLocalCachesForTenant(previousTenantId, nextTenantId) {
  const prev = (previousTenantId || '').trim();
  const next = (nextTenantId || '').trim();
  if (!next || prev === next) return;

  // Drop unscoped legacy keys so they cannot leak across offices.
  for (const key of LEGACY_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
