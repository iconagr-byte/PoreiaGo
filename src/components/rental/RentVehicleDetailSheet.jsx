import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { enrichRentVehicle } from '../../lib/rental/rentFleetEnrichment.js';

function vehiclePhotos(v) {
  const urls = v?.photo_urls?.length ? v.photo_urls : v?.photo_url ? [v.photo_url] : [];
  return [...new Set(urls.filter(Boolean))];
}

function euro(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return `€${Math.round(x)}`;
}

function buildHook(v) {
  const seats = Number(v.seating_capacity) || 0;
  const fuel = String(v.fuel || v.fuel_type || '').toLowerCase();
  const cat = String(v.category_label || v.size_label || '').toLowerCase();
  if (/ηλεκτρ|ev|electric/.test(fuel)) {
    return 'Σιωπηλή οδήγηση, καθαρή ενέργεια — ιδανικό για πόλη και ακτές χωρίς άγχος καυσίμου.';
  }
  if (/υβριδ/.test(fuel)) {
    return 'Υβριδική οικονομία για περισσότερα χιλιόμετρα με λιγότερο κόστος στο ταξίδι σου.';
  }
  if (seats >= 7 || /van|family|οικογεν/.test(cat)) {
    return 'Χώρος για όλη την παρέα — βαλίτσες, παραλία και άνεση σε κάθε διαδρομή.';
  }
  if (/suv|crossover|jeep/.test(cat)) {
    return 'Ψηλή θέση οδήγησης και σταθερότητα — για επαρχιακούς δρόμους και νησιωτικά μονοπάτια.';
  }
  if (/compact|οικονομ|economy|city/.test(cat) || seats <= 4) {
    return 'Ελαφρύ, οικονομικό και εύκολο στο πάρκινγκ — το σωστό όχημα για πόλη και κοντινές εξορμήσεις.';
  }
  return (
    v.display_headline ||
    'Καθαρό, ασφαλισμένο και έτοιμο για παραλαβή — ξεκίνα το ταξίδι χωρίς καθυστερήσεις.'
  );
}

/**
 * Vehicle detail overlay — portal to body so fixed positioning stays over the
 * tapped card (not trapped by wallet transforms / low stacking contexts).
 * Layout inspired by clean rental detail apps; PoreiaGo teal/deep palette (not Hertz yellow).
 */
export default function RentVehicleDetailSheet({
  vehicle,
  onClose,
  onSelect,
  selectLabel = 'Επιλογή οχήματος',
  totalPrice = null,
  days = null,
}) {
  const v = enrichRentVehicle(vehicle);
  const photos = vehiclePhotos(v);
  const cover = photos[0] || '';
  const classTitle = String(v.category_label || v.size_label || v.display_headline || 'Όχημα').trim();
  const modelLine = `${v.model || 'Όχημα'}${v.similar_label ? ` ${v.similar_label}` : ' ή παρόμοιο'}`;
  const hook = buildHook(v);

  const seatsLabel =
    Number(v.seating_capacity) > 0
      ? `${v.seating_capacity}`
      : String(v.seats_label || '').replace(/[^\d]/g, '') || '—';
  const bagsLabel =
    Number(v.luggage_bags) > 0
      ? `${v.luggage_bags}`
      : String(v.luggage_label || '').replace(/^x/i, '') || '—';
  const gearLabel = /αυτόματο/i.test(String(v.transmission || ''))
    ? 'Αυτόματο'
    : String(v.transmission || 'Χειροκίνητο');
  const fuelLabel = String(v.fuel || v.fuel_type || '').trim() || 'A/C';
  const doorsLabel = v.doors ? `${v.doors}` : null;

  const specs = [
    { icon: 'person', value: seatsLabel, caption: 'Επιβάτες' },
    { icon: 'luggage', value: bagsLabel, caption: 'Βαλίτσες' },
    { icon: 'settings', value: gearLabel, caption: 'Κιβώτιο' },
    { icon: 'local_gas_station', value: fuelLabel, caption: 'Καύσιμο' },
    doorsLabel ? { icon: 'sensor_door', value: doorsLabel, caption: 'Πόρτες' } : null,
    { icon: 'ac_unit', value: 'A/C', caption: 'Κλιματισμός' },
  ].filter(Boolean);

  const inclusions = [
    'Βασική ασφάλεια σύμφωνα με όρους γραφείου',
    'Δωρεάν ακύρωση έως 24ώρες πριν',
    'Παραλαβή με έγκυρη άδεια οδήγησης',
    Array.isArray(v.highlights) && v.highlights[0] ? v.highlights[0] : 'Καθαρισμένο & έτοιμο προς παράδοση',
  ];

  const dayCount = Number(days) > 0 ? Number(days) : Number(v.suggested_days) > 0 ? Number(v.suggested_days) : 0;
  const total =
    totalPrice != null && Number.isFinite(Number(totalPrice))
      ? Number(totalPrice)
      : v.suggested_total != null
        ? Number(v.suggested_total)
        : v.daily_rate_eur != null
          ? Number(v.daily_rate_eur)
          : null;
  const priceIsDaily = totalPrice == null && v.suggested_total == null && v.daily_rate_eur != null;
  const priceLabel = euro(total);
  const priceKicker = priceIsDaily
    ? 'από / ημέρα'
    : dayCount > 1
      ? `Σύνολο · ${dayCount} ημέρες`
      : v.price_label || 'Εκτιμώμενο σύνολο';

  useEffect(() => {
    if (!vehicle) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [vehicle, onClose]);

  if (!vehicle || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="rent-sheet-backdrop rent-sheet-backdrop--over-vehicle"
      role="dialog"
      aria-modal="true"
      aria-label={v.model || 'Λεπτομέρειες οχήματος'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="rent-sheet rent-sheet--detail rent-sheet--hero">
        <div className="rent-sheet-scroll">
          <div className="rent-sheet-hero">
            <button
              type="button"
              className="rent-sheet-icon-close"
              onClick={onClose}
              aria-label="Κλείσιμο"
            >
              <span className="material-symbols-outlined" aria-hidden>
                close
              </span>
            </button>
            {cover ? (
              <img src={cover} alt={v.model || 'Όχημα'} />
            ) : (
              <div className="rent-vehicle-placeholder rent-sheet-hero-fallback">
                <span className="material-symbols-outlined">directions_car</span>
              </div>
            )}
            {classTitle ? <span className="rent-sheet-hero-badge">{classTitle}</span> : null}
          </div>

          <div className="rent-sheet-body rent-sheet-body--hero">
            <header className="rent-sheet-titleblock">
              <h3>{v.model || 'Όχημα'}</h3>
              <p className="rent-sheet-similar">{modelLine}</p>
            </header>

            <p className="rent-sheet-hook">{hook}</p>

            <ul className="rent-sheet-specgrid" aria-label="Χαρακτηριστικά">
              {specs.map((s) => (
                <li key={`${s.icon}-${s.caption}`}>
                  <span className="material-symbols-outlined" aria-hidden>
                    {s.icon}
                  </span>
                  <strong>{s.value}</strong>
                  <span>{s.caption}</span>
                </li>
              ))}
            </ul>

            {Array.isArray(v.highlights) && v.highlights.length > 1 ? (
              <ul className="rent-sheet-tags">
                {v.highlights.slice(0, 4).map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            ) : null}

            <div className="rent-sheet-perks">
              <h4>Τι περιλαμβάνεται</h4>
              <ul>
                {inclusions.map((line) => (
                  <li key={line}>
                    <span className="material-symbols-outlined" aria-hidden>
                      check_circle
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rent-sheet-priceband">
              <div>
                <span className="rent-sheet-kicker">{priceKicker}</span>
                <strong className="rent-sheet-price">
                  {priceLabel || '—'}
                  {!priceIsDaily && priceLabel ? <em> εκτ.</em> : null}
                </strong>
              </div>
              <p>Τελική τιμή στο checkout · καύσιμα & χλμ. βάσει πολιτικής γραφείου</p>
            </div>

            <div className="rent-sheet-terms">
              <p>
                Απαιτείται έγκυρη άδεια οδήγησης. Η κράτηση δεσμεύει το όχημα της κατηγορίας· το ακριβές
                μοντέλο μπορεί να αντικατασταθεί με ισοδύναμο.
              </p>
            </div>
          </div>
        </div>

        {onSelect ? (
          <div className="rent-sheet-footer rent-sheet-footer--hero">
            <button
              type="button"
              className="rent-pick-cta rent-sheet-cta"
              onClick={() => {
                onSelect(vehicle);
                onClose?.();
              }}
            >
              {selectLabel}
              <span className="material-symbols-outlined" aria-hidden>
                arrow_forward
              </span>
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
