/**
 * Hybrid trip / flight API client (SaaS operations).
 */
import { getSaasToken, saasFetch } from './saasApi.js';

async function hybridFetch(path, options = {}) {
  if (!getSaasToken()) {
    throw new Error('Απαιτείται σύνδεση γραφείου για συγχρονισμό hybrid δεδομένων.');
  }
  return saasFetch(path, options);
}

export async function fetchHybridTrip(tripId) {
  return hybridFetch(`/api/v1/operations/trips/${tripId}/hybrid`);
}

export async function upsertFlight(tripId, flight) {
  return hybridFetch(`/api/v1/operations/trips/${tripId}/flights`, {
    method: 'POST',
    body: JSON.stringify(flight),
  });
}

export async function deleteFlightRemote(tripId, flightId) {
  return hybridFetch(`/api/v1/operations/trips/${tripId}/flights/${flightId}`, {
    method: 'DELETE',
  });
}

export async function replaceSegments(tripId, segments) {
  return hybridFetch(`/api/v1/operations/trips/${tripId}/segments`, {
    method: 'PUT',
    body: JSON.stringify({ segments }),
  });
}

export async function upsertLuggageRemote(tripId, item) {
  return hybridFetch(`/api/v1/operations/trips/${tripId}/luggage`, {
    method: 'POST',
    body: JSON.stringify(item),
  });
}

export async function listLuggageRemote(tripId) {
  return hybridFetch(`/api/v1/operations/trips/${tripId}/luggage`);
}

export async function pollFlightStatus(flightId) {
  return hybridFetch(`/api/v1/operations/flights/${flightId}/status/poll`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function notifyFlightDelay(flightId, payload = {}) {
  return hybridFetch(`/api/v1/operations/flights/${flightId}/notify-delay`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function calculateYieldRemote(payload) {
  return hybridFetch('/api/v1/operations/hybrid/yield', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Best-effort sync of local hybrid trip fields to Postgres. */
export async function syncHybridTripToServer(trip) {
  if (!trip?.id || !getSaasToken()) return null;
  try {
    const flights = trip.flights || [];
    for (const f of flights) {
      if (!f.flight_number || !f.departure_airport || !f.arrival_airport) continue;
      if (!f.departure_time || !f.arrival_time) continue;
      await upsertFlight(trip.id, {
        ...f,
        id: looksLikeUuid(f.id) ? f.id : undefined,
        trip_title: trip.title,
        seats_allocated: Number(f.seats_allocated ?? f.seatsAllocated) || 0,
        cost_per_seat: Number(f.cost_per_seat ?? f.costPerSeat) || 0,
        total_cost: Number(f.total_cost ?? f.totalCost) || 0,
      });
    }
    const segments = (trip.segments || []).map((s, i) => ({
      ...s,
      id: looksLikeUuid(s.id) ? s.id : undefined,
      sequence: s.sequence ?? i,
      ground_cost: Number(s.ground_cost ?? s.groundCost) || 0,
      flight_id: looksLikeUuid(s.flight_id) ? s.flight_id : null,
    }));
    if (segments.length) {
      await replaceSegments(trip.id, segments);
    }
    return true;
  } catch (err) {
    console.warn('[hybrid-sync]', err.message || err);
    return false;
  }
}

function looksLikeUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || ''),
  );
}
