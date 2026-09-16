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
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}
