/**
 * Platform demo trips/bookings — strip from authenticated offices for production.
 *
 * Achillio Travel may reuse the same marketing titles (Μετέωρα / Αθήνα / Ιωάννινα)
 * with reserved office-seed ids 91001+ — those must stay in Διαχείριση Εκδρομών.
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

/** Historic PoreiaGo mockData ids — never office catalog rows. */
export const DEMO_TRIP_IDS = new Set([1, 2, 3, 4, 5, 6]);

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
  const tripId = Number(booking.tripId ?? booking.trip_id);
  // Achillio office-seed trips reuse PoreiaGo marketing titles (Μετέωρα etc.) —
  // real guest/wallet bookings on those ids must stay in Κρατήσεις.
  if (Number.isFinite(tripId) && OFFICE_SEED_TRIP_IDS.has(tripId)) {
    return false;
  }
  if (Number.isFinite(tripId) && DEMO_TRIP_IDS.has(tripId)) {
    return true;
  }
  // Title-only strip for legacy platform demos (small ids / missing trip).
  if (isDemoTripTitle(booking.tripTitle)) {
    if (!Number.isFinite(tripId) || tripId <= 0 || tripId < 1000) {
      return true;
    }
  }
  return false;
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
    const id = Number(t?.id);
    // Platform mock ids 1–6 always go.
    if (Number.isFinite(id) && DEMO_TRIP_IDS.has(id)) return false;
    // Title match only for small/platform-like ids — never wipe office timestamp
    // ids or Achillio seed copies that reuse the same marketing titles.
    if (isDemoTripTitle(t?.title) && Number.isFinite(id) && id > 0 && id < 1000) {
      return false;
    }
    return true;
  });
}

export function stripDemoBookings(bookings) {
  if (!Array.isArray(bookings)) return [];
  return bookings.filter((b) => !isDemoBooking(b));
}
