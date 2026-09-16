/**
 * Airbnb-style photo collage for trip detail pages.
 * 1 featured (left) + 4 tiles (2×2 right). Empty slots = placeholders until uploads exist.
 */
const SLOT_COUNT = 5;

function collectTripPhotoUrls(trip) {
  if (!trip || typeof trip !== 'object') return [];
  const raw = [
    ...(Array.isArray(trip.images) ? trip.images : []),
    ...(Array.isArray(trip.gallery) ? trip.gallery : []),
    ...(Array.isArray(trip.photos) ? trip.photos : []),
    ...(Array.isArray(trip.gallery_urls) ? trip.gallery_urls : []),
    trip.image,
    trip.image_url,
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

function PhotoSlot({ src, featured = false, index = 0 }) {
  return (
    <div
      className={`relative h-full min-h-0 w-full overflow-hidden bg-slate-100 ${
        featured ? 'rounded-2xl sm:rounded-[20px]' : 'rounded-xl sm:rounded-2xl'
      }`}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading={featured ? 'eager' : 'lazy'}
        />
      ) : (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200/80"
          aria-hidden
        >
          <span className="material-symbols-outlined text-slate-300 text-[28px] sm:text-[32px]">
            photo_camera
          </span>
          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300">
            Φωτο {index + 1}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Layout-only collage for now (no stock images).
 * Set `useTripPhotos` when office gallery uploads are ready.
 */
export default function TripPhotoBento({ trip, useTripPhotos = false }) {
  const urls = useTripPhotos ? collectTripPhotoUrls(trip) : [];
  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => urls[i] || null);

  return (
    <section className="w-full" aria-label="Φωτογραφίες εκδρομής">
      {/* Mobile: featured on top + 2×2 below. Desktop: Airbnb bento. */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="h-48 w-full">
          <PhotoSlot src={slots[0]} featured index={0} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {slots.slice(1).map((src, i) => (
            <div key={i} className="h-24">
              <PhotoSlot src={src} index={i + 1} />
            </div>
          ))}
        </div>
      </div>

      <div className="hidden h-[340px] grid-cols-[2fr_1fr_1fr] grid-rows-2 gap-2.5 sm:grid md:h-[400px]">
        <div className="row-span-2 min-h-0">
          <PhotoSlot src={slots[0]} featured index={0} />
        </div>
        <div className="min-h-0">
          <PhotoSlot src={slots[1]} index={1} />
        </div>
        <div className="min-h-0">
          <PhotoSlot src={slots[2]} index={2} />
        </div>
        <div className="min-h-0">
          <PhotoSlot src={slots[3]} index={3} />
        </div>
        <div className="min-h-0">
          <PhotoSlot src={slots[4]} index={4} />
        </div>
      </div>
    </section>
  );
}

export { collectTripPhotoUrls };
