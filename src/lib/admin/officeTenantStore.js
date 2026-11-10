/**
 * Tenant-scoped office data — new offices must not inherit demo/mock data
 * from another tenant on the same browser.
 */

const TOKEN_KEY = 'saas_access_token';
const TENANT_KEY = 'saas_tenant_id';

/** Unscoped keys that historically leaked across offices. */
const LEGACY_KEYS = [
  'aerostride_customers_v1',
  'aerostride_trips_v1',
  'aerostride_bookings_v1',
  'aerostride_site_appearance_v1',
  'aerostride_site_appearance_v2',
  'aerostride_site_appearance_v3',
  'poreiago_branding_v1',
  'poreiago_branding_v2',
  'aerostride_branding_v1',
  'aerostride_platform_settings',
  'aerostride_payment_settings_v1',
  'aerostride_checkout_settings_v1',
  'aerostride_seat_pricing_v1',
  'aerostride_telemetry_settings',
  'poreiago_office_setup_v1',
  'rent_favorites_v1',
  'rent_preferred_vehicle_id_v1',
  'rent_vehicle_snapshot_v1',
  'rent_booking_prefs_v1',
  'rent_funnel_events_v1',
  'rent_reminders_enabled_v1',
  'wallet_last_pass_v1',
];

/** Scoped base keys cleared for the previous tenant on switch. */
const SCOPED_BASES = [
  'aerostride_site_appearance_v2',
  'aerostride_site_appearance_v3',
  'poreiago_branding_v2',
  'aerostride_customers_v1',
  'aerostride_trips_v1',
  'aerostride_bookings_v1',
  'aerostride_payment_settings_v1',
  'aerostride_checkout_settings_v1',
  'aerostride_seat_pricing_v1',
  'aerostride_platform_settings',
  'aerostride_telemetry_settings',
  'aerostride_maintenance_events_v1',
  'aerostride_fleet_resolved_alerts',
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
 * tenant's cached customers / trips / bookings / branding in the same browser.
 */
function _hasScopedPayload(raw) {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.length > 0;
    if (parsed && typeof parsed === 'object') return Object.keys(parsed).length > 0;
  } catch {
    return Boolean(String(raw).trim());
  }
  return Boolean(String(raw).trim());
}

/**
 * Before wiping legacy unscoped keys on login, copy office data into the new
 * tenant scope when that scope is empty — otherwise excursions disappear.
 */
function migrateLegacyOfficeDataToTenant(nextTenantId) {
  const next = (nextTenantId || '').trim();
  if (!next) return;
  const migrateBases = [
    'aerostride_trips_v1',
    'aerostride_bookings_v1',
    'aerostride_customers_v1',
  ];
  for (const base of migrateBases) {
    try {
      const scopedKey = `${base}::${next}`;
      if (_hasScopedPayload(localStorage.getItem(scopedKey))) continue;
      const legacy = localStorage.getItem(base);
      if (!_hasScopedPayload(legacy)) continue;
      localStorage.setItem(scopedKey, legacy);
    } catch {
      /* ignore */
    }
  }
}

export function resetOfficeLocalCachesForTenant(previousTenantId, nextTenantId) {
  const prev = (previousTenantId || '').trim();
  const next = (nextTenantId || '').trim();
  if (!next || prev === next) return;

  // Preserve unscoped trips/bookings/customers into the new tenant key first.
  migrateLegacyOfficeDataToTenant(next);

  for (const key of LEGACY_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  if (prev) {
    for (const base of SCOPED_BASES) {
      try {
        localStorage.removeItem(`${base}::${prev}`);
      } catch {
        /* ignore */
      }
    }
  }
}
