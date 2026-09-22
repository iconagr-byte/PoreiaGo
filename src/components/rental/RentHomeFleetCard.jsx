import { enrichRentVehicle } from '../../lib/rental/rentFleetEnrichment.js';

/**
 * Vehicle pick card — photo-first, rent teal, clear price + CTA.
 * Double-click / photo tap opens vehicle detail sheet.
 */
export default function RentHomeFleetCard({
  vehicle,
  favorite = false,
  onToggleFavorite,
  onSelect,
  onOpenDetails,
  ctaLabel = 'Επιλογή',
}) {
  const v = enrichRentVehicle(vehicle);
  const cover = v.photo_urls?.[0] || v.photo_url || '';
  const groupLine = [v.group_code, v.size_label].filter(Boolean).join(' · ');
  const rate =
    v.daily_rate_eur != null && v.daily_rate_eur !== ''
      ? Number(v.daily_rate_eur)
      : null;

  const specs = [
    { icon: 'group', label: v.seats_label || 'Επιβάτες' },
    { icon: 'luggage', label: v.luggage_label || 'Αποσκευές' },
    { icon: 'ac_unit', label: v.ac_label || 'A/C' },
    { icon: 'settings', label: v.transmission || 'Με ταχύτητες' },
  ];

  const openDetails = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    onOpenDetails?.(vehicle);
  };

  return (
    <article
      className="rent-pick"
      onDoubleClick={openDetails}
      title="Διπλό κλικ για περισσότερες φωτογραφίες & στοιχεία μίσθωσης"
    >
      <button
        type="button"
        className="rent-pick-media"
        onClick={openDetails}
        aria-label={`Λεπτομέρειες ${v.model || 'οχήματος'}`}
      >
        {cover ? (
          <img src={cover} alt={v.model || 'Όχημα'} loading="lazy" />
        ) : (
          <span className="material-symbols-outlined rent-pick-media-fallback">directions_car</span>
        )}
        {groupLine ? <span className="rent-pick-badge">{groupLine}</span> : null}
        <span className="rent-pick-media-hint">
          <span className="material-symbols-outlined" aria-hidden>
            photo_library
          </span>
          Φωτογραφίες
        </span>
      </button>

      <button
        type="button"
        className={`rent-pick-fav${favorite ? ' is-on' : ''}`}
        aria-label={favorite ? 'Αφαίρεση από αγαπημένα' : 'Προσθήκη στα αγαπημένα'}
        aria-pressed={favorite}
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

      <div className="rent-pick-body">
        <header className="rent-pick-top">
          <h3 className="rent-pick-title">
            <span>{v.model || 'Όχημα'}</span>
            {v.similar_label ? <em>{v.similar_label}</em> : null}
          </h3>
        </header>

        <ul className="rent-pick-specs" aria-label="Χαρακτηριστικά">
          {specs.map((s) => (
            <li key={s.icon}>
              <span className="material-symbols-outlined" aria-hidden>
                {s.icon}
              </span>
              <span>{s.label}</span>
            </li>
          ))}
        </ul>

        <div className="rent-pick-foot">
          <div className="rent-pick-price-block">
            {rate != null && Number.isFinite(rate) ? (
              <>
                <span className="rent-pick-price-kicker">από</span>
                <p className="rent-pick-price">
                  <span className="rent-pick-price-amount">€{rate.toFixed(0)}</span>
                  <span className="rent-pick-price-unit">/ημέρα</span>
                </p>
              </>
            ) : v.price_label ? (
              <p className="rent-pick-price rent-pick-price--plain">{v.price_label}</p>
            ) : (
              <p className="rent-pick-price-kicker">Τιμή κατόπιν επιλογής</p>
            )}
          </div>
          <button
            type="button"
            className="rent-pick-cta"
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.();
            }}
          >
            {ctaLabel}
            <span className="material-symbols-outlined" aria-hidden>
              arrow_forward
            </span>
          </button>
        </div>
      </div>
    </article>
  );
}
