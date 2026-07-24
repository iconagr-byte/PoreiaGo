/**
 * Local GDPR-style purge of hybrid passenger PII after trip end.
 */
import { loadTrips, upsertTrip } from '../trips/tripStore.js';

function tripEnded(trip, now = Date.now()) {
  const candidates = [
    trip.arrivalTime,
    trip.departureTime,
    ...(trip.segments || []).map((s) => s.ends_at || s.starts_at),
    ...(trip.flights || []).map((f) => f.arrival_time),
  ].filter(Boolean);
  if (!candidates.length) return false;
  const latest = Math.max(...candidates.map((v) => new Date(v).getTime()).filter((n) => !Number.isNaN(n)));
  return latest > 0 && latest < now;
}

export function purgeHybridPassengerPii(trip, { actor = 'office' } = {}) {
  if (!trip) return trip;
  const purgedSeats = (trip.passengerFlightSeats || []).map((s, i) => ({
    ...s,
    passenger_name: `Επιβάτης ${i + 1}`,
    booking_id: '',
    ticket_code: '',
    pnr_code: s.pnr_code ? 'REDACTED' : '',
    ground_seat: s.ground_seat || '',
    flight_seat: s.flight_seat || '',
  }));
  const purgedLuggage = (trip.luggageCheckins || []).map((l, i) => ({
    ...l,
    passenger_name: `Επιβάτης ${i + 1}`,
    booking_id: '',
    luggage_notes: '',
    checked_by: '',
  }));
  const purgedRooms = (trip.roomingList || []).map((r, i) => ({
    ...r,
    passenger_name: `Επιβάτης ${i + 1}`,
    notes: '',
  }));
  return {
    ...trip,
    passengerFlightSeats: purgedSeats,
    luggageCheckins: purgedLuggage,
    roomingList: purgedRooms,
    passengerExtras: (trip.passengerExtras || []).map((e, i) => ({
      ...e,
      passenger_name: `Επιβάτης ${i + 1}`,
      notes: '',
    })),
    gdprPurgedAt: new Date().toISOString(),
    gdprPurgedBy: actor,
  };
}

/** Purge all ended trips (or a single tripId). Returns count purged. */
export function runHybridGdprPurge({ tripId = null, onlyEnded = true, actor = 'office' } = {}) {
  const trips = loadTrips();
  let count = 0;
  for (const trip of trips) {
    if (tripId != null && Number(trip.id) !== Number(tripId)) continue;
    if (onlyEnded && !tripEnded(trip)) continue;
    if (trip.gdprPurgedAt) continue;
    const next = purgeHybridPassengerPii(trip, { actor });
    upsertTrip(next);
    count += 1;
  }
  return count;
}

export function isTripEndedForPurge(trip) {
  return tripEnded(trip);
}
