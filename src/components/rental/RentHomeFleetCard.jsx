import { enrichRentVehicle } from '../../lib/rental/rentFleetEnrichment.js';

/**
 * Apple-clean fleet card — photo, name, one meta line, price.
 */
export default function RentHomeFleetCard({
  vehicle,
  favorite = false,
  onToggleFavorite,
  onSelect,
}) {
  const v = enrichRentVehicle(vehicle);
  const cover = v.photo_urls?.[0] || v.photo_url || '';
  const meta = [v.category_label, v.seats_label, v.transmission].filter(Boolean).join(' · ');

  return (
    <button type="button" className="rent-fleet-tile" onClick={onSelect}>
      <span
        className="rent-fleet-tile-fav"
        role="button"
        tabIndex={0}
        aria-label={favorite ? 'Αφαίρεση από αγαπημένα' : 'Προσθήκη στα αγαπημένα'}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFavorite?.();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite?.();
          }
        }}
      >
        <span className="material-symbols-outlined" aria-hidden>
          {favorite ? 'favorite' : 'favorite_border'}
        </span>
      </span>

      <div className="rent-fleet-tile-media">
        {cover ? (
          <img src={cover} alt={v.model || 'Όχημα'} loading="lazy" />
        ) : (
          <span className="material-symbols-outlined">directions_car</span>
        )}
      </div>

      <div className="rent-fleet-tile-body">
        <strong className="rent-fleet-tile-name">{v.model || 'Όχημα'}</strong>
        {meta ? <span className="rent-fleet-tile-meta">{meta}</span> : null}
        <span className="rent-fleet-tile-price">
          {v.price_label || 'Τιμή κατόπιν επικοινωνίας'}
        </span>
      </div>
    </button>
  );
}
