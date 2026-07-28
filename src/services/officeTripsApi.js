import { API_BASE } from '../config/api.js';
import { normalizeTrip } from '../lib/trips/tripMarket.js';

/**
 * Published trips for the current office Host (tenant-scoped).
 * Never falls back to shared mock / localStorage catalogs.
 */
export async function fetchPublicOfficeTrips() {
  try {
    const host = typeof window !== 'undefined' ? window.location.host : '';
    const qs = host ? `?host=${encodeURIComponent(host)}` : '';
    const res = await fetch(`${API_BASE}/api/site/trips${qs}`);
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
