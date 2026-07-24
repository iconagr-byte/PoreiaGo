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
    destination: trip.destination || '',
    meeting_point: trip.meetingPoint || trip.meeting_point || '',
    meetingPoint: trip.meetingPoint || trip.meeting_point || '',
    departure_time: trip.departureTime || trip.departure_time || '',
    departureTime: trip.departureTime || trip.departure_time || '',
    arrival_time: trip.arrivalTime || trip.arrival_time || '',
    arrivalTime: trip.arrivalTime || trip.arrival_time || '',
    stops: Array.isArray(trip.stops) ? trip.stops : [],
    segments: Array.isArray(trip.segments) ? trip.segments : [],
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
export async function syncTripsToPostgres(trips, { tenantId } = {}) {
  const payload = {
    tenant_id: tenantId || getSaasTenantId() || undefined,
    trips: (trips || []).map(tripToPayload),
  };

  if (getSaasToken()) {
    try {
      return await saasFetch('/api/v1/operations/trips/sync', {
        method: 'POST',
        body: JSON.stringify({ trips: payload.trips }),
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

/** Sync every trip from tripStore (admin panels). */
export async function syncAllLocalTrips() {
  const { loadTrips } = await import('../lib/trips/tripStore.js');
  return syncTripsToPostgres(loadTrips());
}
