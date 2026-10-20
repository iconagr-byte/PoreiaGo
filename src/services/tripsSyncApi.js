/**
 * Mirror localStorage trips into Postgres `trips` (same id) for Master QR / pricing.
 */
import { adminFetch } from './adminApi.js';
import { getSaasTenantId, getSaasToken, saasFetch } from './saasApi.js';

function tripToPayload(trip) {
  return {
    id: trip.id,
    title: trip.title || '',
    price: Number(trip.price) || 0,
    available_seats: trip.availableSeats ?? null,
    total_seats: trip.totalSeats || trip.capacity || null,
    availableSeats: trip.availableSeats ?? null,
    totalSeats: trip.totalSeats || trip.capacity || null,
    destination: trip.destination || '',
    meeting_point: trip.meetingPoint || trip.meeting_point || '',
    meetingPoint: trip.meetingPoint || trip.meeting_point || '',
    departure_time: trip.departureTime || trip.departure_time || '',
    departureTime: trip.departureTime || trip.departure_time || '',
    arrival_time: trip.arrivalTime || trip.arrival_time || '',
    arrivalTime: trip.arrivalTime || trip.arrival_time || '',
    stops: Array.isArray(trip.stops) ? trip.stops : [],
    segments: Array.isArray(trip.segments) ? trip.segments : [],
    status: trip.status === 'draft' ? 'draft' : 'published',
    featured: Boolean(trip.featured),
    description: trip.description || '',
    image: trip.image || '',
    images: Array.isArray(trip.images)
      ? trip.images.map((u) => String(u || '').trim()).filter(Boolean)
      : [],
    hook: trip.hook || '',
    durationLabel: trip.durationLabel || '',
    badge: trip.badge || '',
    highlights: Array.isArray(trip.highlights) ? trip.highlights : [],
    market: trip.market || null,
    vehicleType: trip.vehicleType || '',
    currency: trip.currency || 'EUR',
    childPrice:
      trip.childPrice === null || trip.childPrice === undefined || trip.childPrice === ''
        ? null
        : Number(trip.childPrice),
  };
}

async function parseAdminError(res) {
  const err = await res.json().catch(() => ({}));
  let detail = err.detail ?? res.statusText ?? 'Sync failed';
  if (Array.isArray(detail)) {
    detail = detail.map((d) => d.msg || JSON.stringify(d)).join(', ');
  }
  throw new Error(String(detail));
}

/**
 * @param {object[]} trips
 * @returns {Promise<{ synced: number, skipped: number, postgres_available: boolean }>}
 */
export async function syncTripsToPostgres(trips, { tenantId, replaceCatalog = false, pruneMissing = false } = {}) {
  const payload = {
    tenant_id: tenantId || getSaasTenantId() || undefined,
    replace_catalog: Boolean(replaceCatalog),
    prune_missing: Boolean(pruneMissing),
    trips: (trips || []).map(tripToPayload),
  };

  if (getSaasToken()) {
    try {
      return await saasFetch('/api/v1/operations/trips/sync', {
        method: 'POST',
        body: JSON.stringify({
          trips: payload.trips,
          replace_catalog: payload.replace_catalog,
          prune_missing: payload.prune_missing,
        }),
      });
    } catch (err) {
      console.warn('[trips-sync] SaaS API failed, trying admin sync', err);
    }
  }

  const res = await adminFetch('/api/admin/platform/trips/sync', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) await parseAdminError(res);
  return res.json();
}

/** Fire-and-forget single trip after save. */
export function syncTripToPostgres(trip) {
  if (!trip?.id) return;
  syncTripsToPostgres([trip]).catch((err) => {
    console.warn('[trips-sync]', err.message || err);
  });
}

/** Sync every trip from tripStore (admin panels) — replaces public catalog. */
export async function fetchOfficeTripCatalog() {
  if (getSaasToken()) {
    try {
      const data = await saasFetch('/api/v1/operations/trips');
      if (Array.isArray(data?.trips)) return data.trips;
      if (Array.isArray(data)) return data;
    } catch (err) {
      console.warn('[trips-sync] catalog fetch via SaaS failed', err);
    }
  }
  const res = await adminFetch('/api/admin/platform/trips', { method: 'GET' });
  if (!res.ok) await parseAdminError(res);
  const data = await res.json();
  if (Array.isArray(data?.trips)) return data.trips;
  return Array.isArray(data) ? data : [];
}

/** Hydrate local trip list from durable server catalog (+ Postgres titles).
 * Also merges public /api/site/trips so storefront-seeded office trips
 * (e.g. Achillio 91001–91003) always appear in Διαχείριση Εκδρομών.
 */
export async function hydrateTripsFromServer() {
  const { mergeServerTripsIntoStore } = await import('../lib/trips/tripStore.js');
  let rows = [];
  try {
    rows = await fetchOfficeTripCatalog();
  } catch (err) {
    console.warn('[trips-sync] admin catalog fetch failed', err);
    rows = [];
  }

  try {
    const { fetchPublicOfficeTrips } = await import('./officeTripsApi.js');
    const pub = await fetchPublicOfficeTrips();
    if (Array.isArray(pub) && pub.length) {
      const byId = new Map();
      for (const row of rows || []) {
        const id = Number(row?.id);
        if (Number.isFinite(id) && id > 0) byId.set(id, row);
      }
      for (const row of pub) {
        const id = Number(row?.id);
        if (!Number.isFinite(id) || id <= 0) continue;
        const prev = byId.get(id) || {};
        byId.set(id, {
          ...prev,
          ...row,
          officeSeed: Boolean(row.officeSeed || row.office_seed || prev.officeSeed),
          catalogSource:
            row.catalogSource ||
            row.catalog_source ||
            prev.catalogSource ||
            (Number.isFinite(id) && id >= 91001 && id <= 91099 ? 'office_seed' : ''),
        });
      }
      rows = [...byId.values()];
    }
  } catch (err) {
    console.warn('[trips-sync] public catalog merge failed', err);
  }

  return mergeServerTripsIntoStore(rows);
}

export async function syncAllLocalTrips() {
  const { loadTrips, mergeServerTripsIntoStore } = await import(
    '../lib/trips/tripStore.js'
  );
  // Never replace the public catalog with a partial local list.
  try {
    const remote = await fetchOfficeTripCatalog();
    if (remote.length) mergeServerTripsIntoStore(remote);
  } catch (err) {
    console.warn('[trips-sync] pre-sync hydrate failed', err);
  }
  return syncTripsToPostgres(loadTrips(), { replaceCatalog: true, pruneMissing: false });
}
