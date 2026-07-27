import { API_BASE } from '../config/api.js';

export const DEFAULT_OFFICE_MODULES = {
  trips_enabled: true,
  rent_enabled: false,
  plan: 'starter',
  mode: 'trips_only',
};

/**
 * Public office modules for the current (or given) host.
 * Rent-only contracts → homepage shows only Rent; bus + add-on → both.
 */
export async function fetchOfficeModules(host) {
  const effectiveHost =
    host ||
    (typeof window !== 'undefined'
      ? window.location.hostname
      : '');
  const q = effectiveHost ? `?host=${encodeURIComponent(effectiveHost)}` : '';
  try {
    const res = await fetch(`${API_BASE}/api/site/modules${q}`);
    if (!res.ok) return { ...DEFAULT_OFFICE_MODULES };
    const data = await res.json().catch(() => ({}));
    return {
      trips_enabled: data.trips_enabled !== false,
      rent_enabled: Boolean(data.rent_enabled),
      plan: String(data.plan || 'starter'),
      mode: String(data.mode || 'trips_only'),
    };
  } catch {
    return { ...DEFAULT_OFFICE_MODULES };
  }
}

export function isRentOnlyModules(modules) {
  return Boolean(modules?.rent_enabled) && !modules?.trips_enabled;
}
