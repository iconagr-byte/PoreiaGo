import { enrichRentVehicle } from '../../lib/rental/rentFleetEnrichment.js';

/**
 * Vehicle pick card — Hertz-like structure, rent teal brand (not yellow clone).
 */
export default function RentHomeFleetCard({
  vehicle,
  favorite = false,
  onToggleFavorite,
  onSelect,
  ctaLabel = 'Επιλογή',
}) {
  const v = enrichRentVehicle(vehicle);
  const cover = v.photo_urls?.[0] || v.photo_url || '';
  const groupLine = [v.group_code, v.size_label].filter(Boolean).join(' · ');

  const specs = [
    { icon: 'group', label: v.seats_label || 'Επιβάτες' },
    { icon: 'luggage', label: v.luggage_label || 'Αποσκευές' },
    { icon: 'ac_unit', label: v.ac_label || 'Με κλιματισμό' },
    { icon: 'settings', label: v.transmission || 'Με ταχύτητες' },
  ];

  return (
    <article className="rent-pick">
      <button
        type="button"
        className="rent-pick-fav"
        aria-label={favorite ? 'Αφαίρεση από αγαπημένα' : 'Προσθήκη στα αγαπημένα'}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFavorite?.();
        }}
      >
        <span className="material-symbols-outlined" aria-hidden>
          {favorite ? 'favorite' : 'favorite_border'}
        </span>
      </button>

      <div className="rent-pick-top">
        <h3 className="rent-pick-title">
          <span>{v.model || 'Όχημα'}</span>
          {v.similar_label ? <em>{v.similar_label}</em> : null}
        </h3>
        {groupLine ? (
          <p className="rent-pick-group">
            {groupLine}
            <span className="material-symbols-outlined" aria-hidden>
              info
            </span>
          </p>
        ) : null}
        <ul className="rent-pick-specs">
          {specs.map((s) => (
            <li key={s.icon}>
              <span className="material-symbols-outlined" aria-hidden>
                {s.icon}
              </span>
              <span>{s.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rent-pick-media">
        {cover ? (
          <img src={cover} alt={v.model || 'Όχημα'} loading="lazy" />
        ) : (
          <span className="material-symbols-outlined">directions_car</span>
        )}
      </div>

      <div className="rent-pick-foot">
        {v.price_label ? <p className="rent-pick-price">{v.price_label}</p> : null}
        <button type="button" className="rent-pick-cta" onClick={onSelect}>
          {ctaLabel}
        </button>
      </div>
    </article>
  );
}
