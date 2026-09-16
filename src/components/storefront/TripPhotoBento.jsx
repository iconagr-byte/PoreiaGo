/**
 * Airbnb-style photo collage for trip detail pages.
 * 1 featured (left) + 4 tiles (2×2 right). Fills from trip.images / gallery / cover / stops.
 */
import { collectTripPhotoUrls } from '../../lib/trips/tripPhotos.js';

const SLOT_COUNT = 5;

function PhotoSlot({ src, featured = false, index = 0, alt = '' }) {
  return (
    <div
      className={`relative h-full min-h-0 w-full overflow-hidden bg-slate-100 ${
        featured ? 'rounded-2xl sm:rounded-[20px]' : 'rounded-xl sm:rounded-2xl'
      }`}
    >
      {src ? (
        <img
          src={src}
          alt={alt || (featured ? 'Κύρια φωτογραφία εκδρομής' : `Φωτογραφία ${index + 1}`)}
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

export default function TripPhotoBento({ trip }) {
  const urls = collectTripPhotoUrls(trip);
  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => urls[i] || null);
  const title = String(trip?.title || trip?.destination || '').trim();

  return (
    <section className="w-full" aria-label="Φωτογραφίες εκδρομής">
      {/* Mobile: featured on top + 2×2 below. Desktop: Airbnb bento. */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="h-48 w-full">
          <PhotoSlot src={slots[0]} featured index={0} alt={title} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {slots.slice(1).map((src, i) => (
            <div key={i} className="h-24">
              <PhotoSlot src={src} index={i + 1} alt={title} />
            </div>
          ))}
        </div>
      </div>

      <div className="hidden h-[340px] grid-cols-[2fr_1fr_1fr] grid-rows-2 gap-2.5 sm:grid md:h-[400px]">
        <div className="row-span-2 min-h-0">
          <PhotoSlot src={slots[0]} featured index={0} alt={title} />
        </div>
        <div className="min-h-0">
          <PhotoSlot src={slots[1]} index={1} alt={title} />
        </div>
        <div className="min-h-0">
          <PhotoSlot src={slots[2]} index={2} alt={title} />
        </div>
        <div className="min-h-0">
          <PhotoSlot src={slots[3]} index={3} alt={title} />
        </div>
        <div className="min-h-0">
          <PhotoSlot src={slots[4]} index={4} alt={title} />
        </div>
      </div>
    </section>
  );
}

export { collectTripPhotoUrls };
