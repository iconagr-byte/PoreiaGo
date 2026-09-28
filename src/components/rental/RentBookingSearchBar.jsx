import { useEffect, useMemo, useState } from 'react';
import {
  buildRentLocationOptions,
  defaultPickupDateTime,
  defaultReturnDateTime,
  readRentBookingPrefs,
  writeRentBookingPrefs,
} from '../../lib/rental/rentBookingSearch.js';

/**
 * Rent search bar — Hertz/Rentalcars horizontal strip, rent teal brand.
 * variant="hero" = booking.com-style single strip inside the hero.
 */
export default function RentBookingSearchBar({
  brandLabel = 'Γραφείο',
  footerAddress = '',
  pickupLocations = [],
  preferredPickup = '',
  onSearch,
  compact = false,
  variant = 'default',
} = {}) {
  const isHero = variant === 'hero';
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
    onSearch?.(prefs);
  };

  const rootClass = [
    'rent-search',
    compact ? 'rent-search--compact' : '',
    isHero ? 'rent-search--hero' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={rootClass} aria-label="Αναζήτηση ενοικίασης" id="rent-guest-search">
      <form className="rent-search-panel" onSubmit={handleSubmit}>
        <div className={`rent-search-row${differentDropoff ? ' rent-search-row--split' : ''}`}>
          <div className="rent-search-field rent-search-field--place">
            <span className="rent-search-field-icon material-symbols-outlined" aria-hidden>
              search
            </span>
            <div className="rent-search-field-body">
              <span className="rent-search-label">Σημείο παραλαβής</span>
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

          {differentDropoff ? (
            <div className="rent-search-field rent-search-field--place">
              <span className="rent-search-field-icon material-symbols-outlined" aria-hidden>
                flag
              </span>
              <div className="rent-search-field-body">
                <span className="rent-search-label">Σημείο επιστροφής</span>
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
            </div>
          ) : null}

          <div className="rent-search-field rent-search-field--date">
            <span className="rent-search-field-icon material-symbols-outlined" aria-hidden>
              calendar_month
            </span>
            <div className="rent-search-field-body">
              <span className="rent-search-label">Παραλαβή</span>
              <input
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
            </div>
          </div>

          <div className="rent-search-field rent-search-field--time">
            <span className="rent-search-field-icon material-symbols-outlined" aria-hidden>
              schedule
            </span>
            <div className="rent-search-field-body">
              <span className="rent-search-label">Ώρα</span>
              <input
                type="time"
                value={pickupParts.time}
                onChange={(e) => setStartTime(mergeDateTime(pickupParts.date, e.target.value))}
                aria-label="Ώρα παραλαβής"
              />
            </div>
          </div>

          <div className="rent-search-field rent-search-field--date">
            <span className="rent-search-field-icon material-symbols-outlined" aria-hidden>
              event_available
            </span>
            <div className="rent-search-field-body">
              <span className="rent-search-label">Επιστροφή</span>
              <input
                type="date"
                value={returnParts.date}
                onChange={(e) => setEndTime(mergeDateTime(e.target.value, returnParts.time))}
                aria-label="Ημερομηνία επιστροφής"
              />
            </div>
          </div>

          <div className="rent-search-field rent-search-field--time">
            <span className="rent-search-field-icon material-symbols-outlined" aria-hidden>
              schedule
            </span>
            <div className="rent-search-field-body">
              <span className="rent-search-label">Ώρα</span>
              <input
                type="time"
                value={returnParts.time}
                onChange={(e) => setEndTime(mergeDateTime(returnParts.date, e.target.value))}
                aria-label="Ώρα επιστροφής"
              />
            </div>
          </div>

          <button type="submit" className="rent-search-submit">
            Αναζήτηση
          </button>
        </div>

        <div className="rent-search-footer">
          <label className="rent-search-check">
            <input
              type="checkbox"
              checked={differentDropoff}
              onChange={(e) => {
                const on = e.target.checked;
                setDifferentDropoff(on);
                if (!on) setDropoffLocation(pickupLocation);
              }}
            />
            <span>Παράδοση σε διαφορετικό σημείο</span>
          </label>
          <label className="rent-search-check">
            <input
              type="checkbox"
              checked={promoOpen}
              onChange={(e) => {
                const on = e.target.checked;
                setPromoOpen(on);
                writeRentBookingPrefs({
                  promo_code: on ? String(promoCode || '').trim() : '',
                });
              }}
            />
            <span>Κωδικός προσφοράς</span>
          </label>
          {promoOpen ? (
            <input
              className="rent-search-promo-input"
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
          ) : null}
        </div>

        {error ? <p className="rent-search-error">{error}</p> : null}
      </form>
    </section>
  );
}
