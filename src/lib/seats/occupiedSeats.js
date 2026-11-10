/**
 * Shared seat occupancy helpers — storefront + office desk.
 * Normalizes seat codes so "1a" / "1A" / " 1A " match.
 */

/** @param {unknown} raw */
export function normalizeSeatCode(raw) {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

/**
 * Seat labels from a booking record (array or comma-separated string).
 * @param {object} booking
 * @returns {string[]}
 */
export function extractBookingSeats(booking) {
  if (!booking) return [];
  if (Array.isArray(booking.seats) && booking.seats.length) {
    return booking.seats.map(normalizeSeatCode).filter(Boolean);
  }
  const fromSeat = String(booking.seat || booking.seat_label || '')
    .split(',')
    .map(normalizeSeatCode)
    .filter(Boolean);
  return fromSeat;
}

/**
 * Match booking to a trip by id (and optional title fallback).
 * @param {object} booking
 * @param {object|number|string} tripOrId
 */
export function bookingMatchesTrip(booking, tripOrId) {
  if (!booking) return false;
  const trip =
    tripOrId && typeof tripOrId === 'object'
      ? tripOrId
      : { id: tripOrId, title: undefined };
  const tid = String(trip?.id ?? '');
  if (!tid || tid === 'undefined' || tid === 'null') return false;
  const bid = String(booking.tripId ?? booking.external_trip_id ?? '');
  if (bid && bid === tid) return true;
  const title = String(trip?.title || '').trim();
  if (title && String(booking.tripTitle || '').trim() === title) return true;
  return false;
}

function isInactiveBooking(booking) {
  if (!booking) return true;
  const ps = String(booking.paymentStatus || '').toUpperCase();
  const cs = String(booking.checkInStatus || '').toUpperCase();
  if (ps.includes('CANCELLED') || cs === 'CANCELLED') return true;
  const status = String(booking.status || '').toLowerCase();
  if (
    status.includes('ακυρ') ||
    status === 'cancelled' ||
    status === 'refunded' ||
    status === 'canceled' ||
    status === 'ακυρωμένη'
  ) {
    return true;
  }
  return false;
}

/**
 * Occupied seat codes for a trip from booking records.
 * @param {object|number|string} tripOrId
 * @param {object[]} bookings
 * @returns {Set<string>}
 */
export function seatsTakenForTrip(tripOrId, bookings) {
  const taken = new Set();
  for (const b of bookings || []) {
    if (isInactiveBooking(b)) continue;
    if (!bookingMatchesTrip(b, tripOrId)) continue;
    for (const seat of extractBookingSeats(b)) {
      taken.add(seat);
    }
  }
  return taken;
}

/**
 * @param {string[]} requested
 * @param {Set<string>|string[]} occupied
 * @returns {string[]} conflicting seat codes
 */
export function findSeatConflicts(requested, occupied) {
  const taken =
    occupied instanceof Set
      ? occupied
      : new Set([...(occupied || [])].map(normalizeSeatCode).filter(Boolean));
  return [...new Set((requested || []).map(normalizeSeatCode).filter(Boolean))].filter((s) =>
    taken.has(s),
  );
}
