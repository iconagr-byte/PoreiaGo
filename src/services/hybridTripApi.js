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

function looksLikeUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || ''),
  );
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

export async function replacePassengerSeatsRemote(tripId, seats) {
  return hybridFetch(`/api/v1/operations/trips/${tripId}/passenger-seats`, {
    method: 'PUT',
    body: JSON.stringify({ seats }),
  });
}

export async function upsertLuggageRemote(tripId, item) {
  return hybridFetch(`/api/v1/operations/trips/${tripId}/luggage`, {
    method: 'POST',
    body: JSON.stringify(item),
  });
}

export async function replaceLuggageRemote(tripId, items) {
  return hybridFetch(`/api/v1/operations/trips/${tripId}/luggage`, {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
}

export async function listLuggageRemote(tripId) {
  return hybridFetch(`/api/v1/operations/trips/${tripId}/luggage`);
}

export async function upsertHybridMetaRemote(tripId, meta) {
  return hybridFetch(`/api/v1/operations/trips/${tripId}/meta`, {
    method: 'PUT',
    body: JSON.stringify(meta),
  });
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

/**
 * Best-effort sync of local hybrid trip fields to Postgres:
 * flights, segments, seats, luggage, rooming/extras/crew/buffers.
 */
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

    const seats = (trip.passengerFlightSeats || [])
      .filter((s) => String(s.passenger_name || '').trim())
      .map((s) => ({
        id: looksLikeUuid(s.id) ? s.id : undefined,
        flight_id: looksLikeUuid(s.flight_id) ? s.flight_id : null,
        booking_id: s.booking_id || null,
        passenger_name: String(s.passenger_name).trim(),
        ground_seat: s.ground_seat || null,
        flight_seat: s.flight_seat || null,
        ticket_code: s.ticket_code || null,
        pnr_code: s.pnr_code || null,
      }));
    await replacePassengerSeatsRemote(trip.id, seats);

    const luggage = (trip.luggageCheckins || [])
      .filter((l) => String(l.passenger_name || '').trim())
      .map((l) => ({
        id: looksLikeUuid(l.id) ? l.id : undefined,
        booking_id: l.booking_id || null,
        passenger_name: String(l.passenger_name).trim(),
        checkin_status: l.checkin_status || 'pending',
        luggage_count: Number(l.luggage_count || 0),
        luggage_notes: l.luggage_notes || null,
        checked_by: l.checked_by || null,
        checked_at: l.checked_at || null,
      }));
    await replaceLuggageRemote(trip.id, luggage);

    await upsertHybridMetaRemote(trip.id, {
      rooming_list: Array.isArray(trip.roomingList) ? trip.roomingList : [],
      passenger_extras: Array.isArray(trip.passengerExtras) ? trip.passengerExtras : [],
      supplier_cost_sheets: Array.isArray(trip.supplierCostSheets) ? trip.supplierCostSheets : [],
      crew: trip.crew && typeof trip.crew === 'object' ? trip.crew : {},
      airport_buffers:
        trip.airportBuffers && typeof trip.airportBuffers === 'object' ? trip.airportBuffers : {},
      currency: trip.currency || 'EUR',
      target_margin_pct: Number(trip.targetMarginPct ?? 25),
      connection_threshold_min: Number(trip.connectionThresholdMin ?? 90),
    });

    return true;
  } catch (err) {
    console.warn('[hybrid-sync]', err.message || err);
    return false;
  }
}
