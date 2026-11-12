import { enrichRentVehicle } from '../../lib/rental/rentFleetEnrichment.js';

/**
 * Vehicle result card — Hertz-inspired stack (class → specs → photo → est. total).
 * Greek PoreiaGo copy; yellow accent stripe + teal actions (not Hertz trademarks).
 */
export default function RentOfferCard({
  vehicle,
  selected = false,
  recommended = false,
  totalPrice = null,
  compareAt = null,
  priceKicker = 'Εκτιμώμενο σύνολο',
  priceMeta = '',
  ctaLabel = '',
  onSelect,
  onOpenDetails,
  as = 'article',
  layout = 'hertz',
} = {}) {
  const v = enrichRentVehicle(vehicle);
  const cover = v.photo_urls?.[0] || v.photo_url || '';
  const classTitle = String(v.category_label || v.size_label || v.display_headline || 'Όχημα').trim();
  const similar = String(v.similar_label || '').trim();
  const modelLine = similar
    ? `${v.model || 'Όχημα'} ${similar}`
    : `${v.model || 'Όχημα'} ή παρόμοιο`;

  const seatsLabel =
    Number(v.seating_capacity) > 0
      ? `${v.seating_capacity}`
      : String(v.seats_label || '').replace(/[^\d]/g, '') || '—';
  const bagsLabel =
    Number(v.luggage_bags) > 0
      ? `${v.luggage_bags}`
      : String(v.luggage_label || '').replace(/^x/i, '') || '—';
  const fuelLabel = String(v.fuel || v.fuel_type || '').trim() || 'A/C';
  const gearLabel = /αυτόματο/i.test(String(v.transmission || ''))
    ? 'Αυτόματο'
    : 'Χειροκίνητο';

  const specs = [
    { icon: 'person', label: seatsLabel, title: 'Επιβάτες' },
    { icon: 'luggage', label: bagsLabel, title: 'Αποσκευές' },
    { icon: 'local_gas_station', label: fuelLabel, title: 'Καύσιμο' },
    { icon: 'settings', label: gearLabel, title: 'Κιβώτιο' },
  ];

  const total =
    totalPrice != null && Number.isFinite(Number(totalPrice))
      ? Number(totalPrice)
      : v.suggested_total != null
        ? Number(v.suggested_total)
        : v.daily_rate_eur != null
          ? Number(v.daily_rate_eur)
          : null;
  const was =
    compareAt != null && Number.isFinite(Number(compareAt)) && Number(compareAt) > Number(total || 0)
      ? Number(compareAt)
      : null;
  const priceIsDaily = totalPrice == null && v.suggested_total == null && v.daily_rate_eur != null;
  const days = Number(v.suggested_days) > 0 ? Number(v.suggested_days) : 0;
  const metaLine =
    priceMeta ||
    (days > 1
      ? `${days} ημέρες · απεριόριστα χλμ. σύμφωνα με πολιτική γραφείου`
      : priceIsDaily
        ? 'Τιμή ανά ημέρα · επιβεβαίωση στο checkout'
        : 'Απεριόριστα χλμ. σύμφωνα με πολιτική γραφείου');

  const Tag = as === 'button' ? 'button' : 'article';
  const tagProps =
    as === 'button'
      ? { type: 'button', onClick: () => onSelect?.(vehicle) }
      : {};
  const hertz = layout === 'hertz';

  return (
    <Tag
      className={`rent-offer${hertz ? ' rent-offer--hertz' : ''}${selected ? ' is-selected' : ''}${
        recommended ? ' is-recommended' : ''
      }`}
      {...tagProps}
      aria-pressed={as === 'button' ? selected : undefined}
    >
      {recommended ? <span className="rent-offer-badge">Προτεινόμενο</span> : null}

      <header className="rent-offer-head">
        <h3 className="rent-offer-class">{classTitle}</h3>
        <p className="rent-offer-model">{modelLine}</p>
      </header>

      <ul className="rent-offer-specs" aria-label="Χαρακτηριστικά">
        {specs.map((s) => (
          <li key={s.icon} title={s.title}>
            <span className="material-symbols-outlined" aria-hidden>
              {s.icon}
            </span>
            <span>{s.label}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="rent-offer-media"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onOpenDetails) onOpenDetails(vehicle);
          else onSelect?.(vehicle);
        }}
        aria-label={`Φωτογραφία ${v.model || 'οχήματος'}`}
      >
        {cover ? (
          <img src={cover} alt="" loading="lazy" />
        ) : (
          <span className="material-symbols-outlined rent-offer-media-fallback" aria-hidden>
            directions_car
          </span>
        )}
      </button>

      <footer className="rent-offer-foot">
        <div className="rent-offer-price-block">
          <span className="rent-offer-kicker">
            {priceIsDaily ? 'από / ημέρα' : priceKicker}
          </span>
          <div className="rent-offer-prices">
            {total != null && Number.isFinite(total) ? (
              <strong className="rent-offer-price">
                €{Math.round(total)}
                {hertz && !priceIsDaily ? <span className="rent-offer-est"> εκτ.</span> : null}
              </strong>
            ) : (
              <strong className="rent-offer-price rent-offer-price--muted">—</strong>
            )}
            {was != null ? <span className="rent-offer-was">€{Math.round(was)}</span> : null}
          </div>
        </div>
        {ctaLabel || onSelect ? (
          <span
            className="rent-offer-cta"
            role={as === 'button' ? undefined : 'button'}
            tabIndex={as === 'button' ? undefined : 0}
            onClick={(e) => {
              if (as === 'button') return;
              e.preventDefault();
              e.stopPropagation();
              onSelect?.(vehicle);
            }}
            onKeyDown={(e) => {
              if (as === 'button') return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect?.(vehicle);
              }
            }}
          >
            {ctaLabel || (selected ? 'Επιλεγμένο' : 'Δες λεπτομέρειες')}
            <span className="material-symbols-outlined" aria-hidden>
              arrow_forward
            </span>
          </span>
        ) : null}
      </footer>

      {hertz ? (
        <>
          <p className="rent-offer-meta">{metaLine}</p>
          <span className="rent-offer-member" aria-hidden={false}>
            <span className="material-symbols-outlined" aria-hidden>
              sell
            </span>
            Ξεκλείδωσε καλύτερες τιμές με λογαριασμό
          </span>
        </>
      ) : null}
    </Tag>
  );
}
