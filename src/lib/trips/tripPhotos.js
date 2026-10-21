/** Platform default — not a real trip upload; never show as excursion cover. */
const PLATFORM_DEFAULT_BUS = 'hero-bus-achillio';

function isRealTripPhoto(url) {
  const u = String(url || '').trim();
  if (!u) return false;
  if (u.includes(PLATFORM_DEFAULT_BUS)) return false;
  return true;
}

/** Collect unique photo URLs for trip cards / detail bento. */
export function collectTripPhotoUrls(trip) {
  if (!trip || typeof trip !== 'object') return [];
  const raw = [
    ...(Array.isArray(trip.images) ? trip.images : []),
    ...(Array.isArray(trip.gallery) ? trip.gallery : []),
    ...(Array.isArray(trip.photos) ? trip.photos : []),
    ...(Array.isArray(trip.gallery_urls) ? trip.gallery_urls : []),
    trip.image,
    trip.image_url,
    ...(Array.isArray(trip.stops)
      ? trip.stops.map((s) => s?.image || s?.image_url || '')
      : []),
  ];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const url = typeof item === 'string' ? item.trim() : String(item?.url || '').trim();
    if (!isRealTripPhoto(url) || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/** First real trip photo, or empty string when none uploaded. */
export function tripCoverUrl(trip) {
  return collectTripPhotoUrls(trip)[0] || '';
}

function normTitle(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Match a wallet booking to a published office trip.
 * Prefer numeric tripId (Achillio seeds 91001+), then exact title.
 */
export function findTripForBooking(booking, trips = []) {
  if (!booking || !Array.isArray(trips) || !trips.length) return null;

  const id = Number(booking.tripId ?? booking.trip_id);
  if (Number.isFinite(id) && id > 0) {
    const byId = trips.find((t) => Number(t?.id) === id);
    if (byId) return byId;
  }

  const title = normTitle(booking.tripTitle || booking.trip_title);
  if (!title) return null;
  return trips.find((t) => normTitle(t?.title) === title) || null;
}

/**
 * Cover URL for a My Wallet booking card / pass hero.
 * Uses booking-embedded image fields first, then catalogs (office API, cache, local).
 *
 * On tenant storefront hosts loadTrips() is intentionally empty — callers must
 * pass the sealed-office catalog from fetchPublicOfficeTrips.
 */
export function bookingCoverUrl(booking, ...catalogs) {
  if (!booking || typeof booking !== 'object') return '';

  const embedded = [
    booking.coverImage,
    booking.cover_image,
    booking.image,
    booking.image_url,
    booking.tripImage,
    booking.trip_image,
    booking.tripCover,
    booking.trip_cover,
  ];
  for (const raw of embedded) {
    if (isRealTripPhoto(raw)) return String(raw).trim();
  }

  const trips = catalogs.flatMap((c) => (Array.isArray(c) ? c : [])).filter(Boolean);
  return tripCoverUrl(findTripForBooking(booking, trips));
}
