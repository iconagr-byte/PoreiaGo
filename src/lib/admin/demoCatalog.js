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

/** Achillio Travel starter ids (PoreiaGo demo content adopted as office catalog). */
export const OFFICE_SEED_TRIP_IDS = new Set([91001, 91002, 91003]);

export function isOfficeSeedTrip(trip) {
  if (!trip || typeof trip !== 'object') return false;
  if (trip.officeSeed || trip.office_seed) return true;
  if (String(trip.catalogSource || trip.catalog_source || '').trim() === 'office_seed') {
    return true;
  }
  const id = Number(trip.id);
  return Number.isFinite(id) && OFFICE_SEED_TRIP_IDS.has(id);
}

export function stripDemoTrips(trips) {
  if (!Array.isArray(trips)) return [];
  return trips.filter((t) => {
    // Keep office-owned starter catalog (Achillio seeded from PoreiaGo demos).
    if (isOfficeSeedTrip(t)) return true;
    return !isDemoTripTitle(t?.title);
  });
}

export function stripDemoBookings(bookings) {
  if (!Array.isArray(bookings)) return [];
  return bookings.filter((b) => !isDemoBooking(b));
}
