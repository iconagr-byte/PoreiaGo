/**
 * Platform demo trips/bookings — strip from authenticated offices for production.
 */

export const DEMO_TRIP_TITLES = new Set([
  'Ημερήσια στα Μετέωρα',
  'Απόδραση στην Πρωτεύουσα',
  'Μαγευτικά Ιωάννινα',
  '3ήμερο Ναύπλιο',
    'Παρίσι — City of Light',
  'Ρώμη — La Dolce Vita',
  'Πράγα & Βιέννη',
]);

export const DEMO_BOOKING_REFS = new Set(
  [
    'B-1029',
    'B-1030',
    'B-1031',
    'B-0995',
    'BK-1029',
    'BK-1030',
    'BK-1031',
    'BK-0995',
  ].map((r) => r.toUpperCase()),
);

export function isDemoTripTitle(title) {
  return DEMO_TRIP_TITLES.has(String(title || '').trim());
}

export function isDemoBooking(booking) {
  if (!booking) return false;
  const keys = [booking.id, booking.pnr, booking.ticketRef, booking.reference_code]
    .filter(Boolean)
    .map((v) => String(v).trim().toUpperCase());
  if (keys.some((k) => DEMO_BOOKING_REFS.has(k))) {
    return true;
  }
  return isDemoTripTitle(booking.tripTitle);
}

export function stripDemoTrips(trips) {
  if (!Array.isArray(trips)) return [];
  return trips.filter((t) => !isDemoTripTitle(t?.title));
}

export function stripDemoBookings(bookings) {
  if (!Array.isArray(bookings)) return [];
  return bookings.filter((b) => !isDemoBooking(b));
}
