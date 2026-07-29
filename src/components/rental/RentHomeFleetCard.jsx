import { enrichRentVehicle } from '../../lib/rental/rentFleetEnrichment.js';

/**
 * Interactive fleet card for /rent guest + desktop home.
 */
export default function RentHomeFleetCard({
  vehicle,
  favorite = false,
  onToggleFavorite,
  onSelect,
}) {
  const v = enrichRentVehicle(vehicle);
  const cover = v.photo_urls?.[0] || v.photo_url || '';
  const meta = [v.seats_label, v.transmission, v.fuel, v.luggage].filter(Boolean);

  return (
    <button type="button" className="rent-home-fleet-card rent-home-fleet-card--rich" onClick={onSelect}>
      <span
        className="rent-home-fleet-fav"
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
      <div className="rent-home-fleet-media">
        {cover ? (
          <img src={cover} alt={v.model || 'Όχημα'} loading="lazy" />
        ) : (
          <span className="material-symbols-outlined">directions_car</span>
        )}
      </div>
      <div className="rent-home-fleet-body">
        <span className="rent-home-fleet-cat">{v.category_label || 'Όχημα'}</span>
        <strong>{v.model || 'Όχημα'}</strong>
        <em className="rent-home-fleet-headline">{v.display_headline}</em>
        <p className="rent-home-fleet-blurb">{v.display_blurb}</p>
        {meta.length ? (
          <ul className="rent-home-fleet-specs" aria-label="Χαρακτηριστικά">
            {meta.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        {v.highlights?.length ? (
          <div className="rent-home-fleet-tags">
            {v.highlights.slice(0, 3).map((h) => (
              <span key={h}>{h}</span>
            ))}
          </div>
        ) : null}
        <div className="rent-home-fleet-price-row">
          <span className="rent-home-fleet-price">{v.price_label || 'Τιμή κατόπιν επικοινωνίας'}</span>
          {Number(v.with_driver_daily_eur) > 0 ? (
            <span className="rent-home-fleet-extra">+ οδηγός από €{Number(v.with_driver_daily_eur).toFixed(0)}</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
