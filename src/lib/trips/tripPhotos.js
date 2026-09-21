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
