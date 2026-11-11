import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  RENT_NEED_DATES_DEFAULT_MESSAGE,
  RENT_NEED_DATES_EVENT,
  buildRentLocationOptions,
  consumeNeedRentDates,
  defaultPickupDateTime,
  defaultReturnDateTime,
  focusRentPickupDateField,
  readRentBookingPrefs,
  writeRentBookingPrefs,
} from '../../lib/rental/rentBookingSearch.js';

function formatLegDate(isoDate) {
  if (!isoDate) return '—';
  try {
    const d = new Date(`${isoDate}T12:00:00`);
    if (Number.isNaN(d.getTime())) return isoDate;
    return new Intl.DateTimeFormat('el-GR', {
      day: 'numeric',
      month: 'short',
    }).format(d);
  } catch {
    return isoDate;
  }
}

/**
 * Rent search — book-first panel on hero (location → trip legs → promo → CTA).
 * variant="hero" = white booking card over the photo.
 */
export default function RentBookingSearchBar({
  brandLabel = 'Γραφείο',
  footerAddress = '',
  pickupLocations = [],
  preferredPickup = '',
  onSearch,
  compact = false,
  variant = 'default',
  showDropoffToggle = true,
  showPromo = true,
  submitLabel = 'Δες οχήματα',
} = {}) {
  const isHero = variant === 'hero';
  const ctaLabel = String(submitLabel || '').trim() || 'Δες οχήματα';
  const locations = useMemo(
    () => buildRentLocationOptions({ brandLabel, footerAddress, pickupLocations }),
    [brandLabel, footerAddress, pickupLocations],
  );

  const [differentDropoff, setDifferentDropoff] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [pickupLocation, setPickupLocation] = useState(locations[0]?.value || 'Γραφείο');
  const [dropoffLocation, setDropoffLocation] = useState(locations[0]?.value || 'Γραφείο');
  const [startTime, setStartTime] = useState(() => defaultPickupDateTime());
  const [endTime, setEndTime] = useState(() => defaultReturnDateTime(defaultPickupDateTime()));
  const [promoCode, setPromoCode] = useState('');
  const [error, setError] = useState('');
  const [datesPrompt, setDatesPrompt] = useState('');
  const [datesFocus, setDatesFocus] = useState(false);
  const pickupDateRef = useRef(null);
  const location = useLocation();

  const showDatesPrompt = (message) => {
    const text = String(message || RENT_NEED_DATES_DEFAULT_MESSAGE).trim();
    setDatesPrompt(text || RENT_NEED_DATES_DEFAULT_MESSAGE);
    setDatesFocus(true);
    focusRentPickupDateField();
  };

  useEffect(() => {
    const prefs = readRentBookingPrefs();
    if (prefs.pickup_location) setPickupLocation(prefs.pickup_location);
    if (prefs.dropoff_location) setDropoffLocation(prefs.dropoff_location);
    if (prefs.start_time) setStartTime(prefs.start_time);
    if (prefs.end_time) setEndTime(prefs.end_time);
    if (prefs.promo_code) {
      setPromoCode(prefs.promo_code);
      setPromoOpen(true);
    }
    if (
      prefs.pickup_location &&
      prefs.dropoff_location &&
      String(prefs.pickup_location).trim().toLowerCase() !==
        String(prefs.dropoff_location).trim().toLowerCase()
    ) {
      setDifferentDropoff(true);
    }
  }, []);

  useEffect(() => {
    const applyPending = () => {
      const pending = consumeNeedRentDates();
      const params = new URLSearchParams(location.search || '');
      const wantsDates =
        Boolean(pending) ||
        params.get('need_dates') === '1' ||
        location.hash === '#rent-pickup-date' ||
        location.hash === '#rent-guest-search';
      if (!wantsDates) return;
      showDatesPrompt(pending?.message || RENT_NEED_DATES_DEFAULT_MESSAGE);
    };

    applyPending();

    const onNeed = (e) => {
      const msg = e?.detail?.message || consumeNeedRentDates()?.message;
      showDatesPrompt(msg || RENT_NEED_DATES_DEFAULT_MESSAGE);
    };
    window.addEventListener(RENT_NEED_DATES_EVENT, onNeed);
    return () => window.removeEventListener(RENT_NEED_DATES_EVENT, onNeed);
  }, [location.search, location.hash]);

  useEffect(() => {
    if (!locations.length) return;
    const values = new Set(locations.map((l) => l.value));
    if (!values.has(pickupLocation)) setPickupLocation(locations[0].value);
    if (!differentDropoff) setDropoffLocation(pickupLocation);
  }, [locations, pickupLocation, differentDropoff]);

  useEffect(() => {
    const next = String(preferredPickup || '').trim();
    if (!next || !locations.length) return;
    const values = new Set(locations.map((l) => l.value));
    if (!values.has(next)) return;
    setPickupLocation(next);
    if (!differentDropoff) setDropoffLocation(next);
  }, [preferredPickup, locations, differentDropoff]);

  useEffect(() => {
    if (!showDropoffToggle && differentDropoff) {
      setDifferentDropoff(false);
      setDropoffLocation(pickupLocation);
    }
  }, [showDropoffToggle, differentDropoff, pickupLocation]);

  useEffect(() => {
    if (!showPromo && promoOpen) {
      setPromoOpen(false);
    }
  }, [showPromo, promoOpen]);

  const splitDateTime = (value) => {
    if (!value || !value.includes('T')) return { date: '', time: '10:00' };
    const [date, time] = value.split('T');
    return { date, time: (time || '10:00').slice(0, 5) };
  };

  const mergeDateTime = (date, time) => {
    if (!date) return '';
    return `${date}T${(time || '10:00').slice(0, 5)}`;
  };

  const pickupParts = splitDateTime(startTime);
  const returnParts = splitDateTime(endTime);

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    setError('');
    if (!pickupLocation?.trim()) {
      setError('Επίλεξε σημείο παραλαβής.');
      return;
    }
    if (!startTime || !endTime) {
      setError('Συμπλήρωσε ημερομηνίες παραλαβής και επιστροφής.');
      return;
    }
    if (new Date(endTime) <= new Date(startTime)) {
      setError('Η επιστροφή πρέπει να είναι μετά την παραλαβή.');
      return;
    }

    const drop = differentDropoff ? dropoffLocation || pickupLocation : pickupLocation;
    const prefs = writeRentBookingPrefs({
      pickup_location: pickupLocation.trim(),
      dropoff_location: String(drop || pickupLocation).trim(),
      start_time: startTime,
      end_time: endTime,
      promo_code: promoOpen ? String(promoCode || '').trim() : '',
      one_way: differentDropoff,
    });
    setDatesPrompt('');
    setDatesFocus(false);
    onSearch?.(prefs);
  };

  const rootClass = [
    'rent-search',
    compact ? 'rent-search--compact' : '',
    isHero ? 'rent-search--hero rent-search--book' : '',
    datesFocus ? 'rent-search--need-dates' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={rootClass} aria-label="Αναζήτηση ενοικίασης" id="rent-guest-search">
      <form className="rent-search-panel" onSubmit={handleSubmit}>
        {datesPrompt ? (
          <div className="rent-search-dates-prompt" role="status" aria-live="polite">
            <span className="material-symbols-outlined" aria-hidden>
              calendar_month
            </span>
            <div className="rent-search-dates-prompt-copy">
              <strong>Επίλεξε ημερομηνίες</strong>
              <p>{datesPrompt}</p>
            </div>
            <button
              type="button"
              className="rent-search-dates-prompt-dismiss"
              aria-label="Κλείσιμο"
              onClick={() => {
                setDatesPrompt('');
                setDatesFocus(false);
              }}
            >
              <span className="material-symbols-outlined" aria-hidden>
                close
              </span>
            </button>
          </div>
        ) : null}

        <div className="rent-book-card">
          <div className="rent-book-place">
            <span className="rent-book-place-icon material-symbols-outlined" aria-hidden>
              location_on
            </span>
            <div className="rent-book-place-body">
              <span className="rent-book-label">Παραλαβή &amp; παράδοση</span>
              <select
                value={pickupLocation}
                onChange={(e) => {
                  setPickupLocation(e.target.value);
                  if (!differentDropoff) setDropoffLocation(e.target.value);
                }}
                aria-label="Σημείο παραλαβής"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.value}>
                    {loc.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {showDropoffToggle ? (
            differentDropoff ? (
              <div className="rent-book-place rent-book-place--drop">
                <span className="rent-book-place-icon material-symbols-outlined" aria-hidden>
                  flag
                </span>
                <div className="rent-book-place-body">
                  <span className="rent-book-label">Διαφορετικό σημείο παράδοσης</span>
                  <select
                    value={dropoffLocation}
                    onChange={(e) => setDropoffLocation(e.target.value)}
                    aria-label="Σημείο επιστροφής"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.value}>
                        {loc.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="rent-book-link rent-book-link--inline"
                  onClick={() => {
                    setDifferentDropoff(false);
                    setDropoffLocation(pickupLocation);
                  }}
                >
                  Ίδιο σημείο
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="rent-book-link"
                onClick={() => setDifferentDropoff(true)}
              >
                <span className="material-symbols-outlined" aria-hidden>
                  add
                </span>
                Διαφορετικό σημείο παράδοσης
              </button>
            )
          ) : null}

          <div className={`rent-book-trip${datesFocus ? ' is-dates-focus' : ''}`} id="rent-search-dates">
            <label className={`rent-book-leg${datesFocus ? ' is-prompt' : ''}`}>
              <span className="rent-book-leg-kicker">Παραλαβή</span>
              <span className="rent-book-leg-date">{formatLegDate(pickupParts.date)}</span>
              <span className="rent-book-leg-inputs">
                <input
                  ref={pickupDateRef}
                  id="rent-pickup-date"
                  type="date"
                  value={pickupParts.date}
                  onChange={(e) => {
                    const next = mergeDateTime(e.target.value, pickupParts.time);
                    setStartTime(next);
                    if (endTime && next && new Date(endTime) <= new Date(next)) {
                      setEndTime(defaultReturnDateTime(next));
                    }
                  }}
                  aria-label="Ημερομηνία παραλαβής"
                />
                <input
                  type="time"
                  value={pickupParts.time}
                  onChange={(e) => setStartTime(mergeDateTime(pickupParts.date, e.target.value))}
                  aria-label="Ώρα παραλαβής"
                />
              </span>
            </label>

            <span className="rent-book-trip-arrow material-symbols-outlined" aria-hidden>
              arrow_forward
            </span>

            <label className={`rent-book-leg${datesFocus ? ' is-prompt' : ''}`}>
              <span className="rent-book-leg-kicker">Παράδοση</span>
              <span className="rent-book-leg-date">{formatLegDate(returnParts.date)}</span>
              <span className="rent-book-leg-inputs">
                <input
                  id="rent-return-date"
                  type="date"
                  value={returnParts.date}
                  onChange={(e) => setEndTime(mergeDateTime(e.target.value, returnParts.time))}
                  aria-label="Ημερομηνία επιστροφής"
                />
                <input
                  type="time"
                  value={returnParts.time}
                  onChange={(e) => setEndTime(mergeDateTime(returnParts.date, e.target.value))}
                  aria-label="Ώρα επιστροφής"
                />
              </span>
            </label>
          </div>

          {showPromo ? (
            <div className="rent-book-promo">
              {promoOpen ? (
                <>
                  <label className="rent-book-promo-field">
                    <span className="rent-book-label">Κωδικός προσφοράς</span>
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPromoCode(v);
                        writeRentBookingPrefs({ promo_code: String(v || '').trim() });
                      }}
                      placeholder="π.χ. RENT10"
                      aria-label="Κωδικός προσφοράς"
                      autoCapitalize="characters"
                    />
                  </label>
                  <button
                    type="button"
                    className="rent-book-link rent-book-link--inline"
                    onClick={() => {
                      setPromoOpen(false);
                      setPromoCode('');
                      writeRentBookingPrefs({ promo_code: '' });
                    }}
                  >
                    Αφαίρεση
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="rent-book-link"
                  onClick={() => setPromoOpen(true)}
                >
                  <span className="material-symbols-outlined" aria-hidden>
                    sell
                  </span>
                  Προσθήκη κωδικού προσφοράς
                </button>
              )}
            </div>
          ) : null}

          <button type="submit" className="rent-search-submit rent-book-submit">
            {ctaLabel}
          </button>
        </div>

        {error ? <p className="rent-search-error">{error}</p> : null}
      </form>
    </section>
  );
}
