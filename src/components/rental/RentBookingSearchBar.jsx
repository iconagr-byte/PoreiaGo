import { useEffect, useMemo, useState } from 'react';
import {
  buildRentLocationOptions,
  defaultPickupDateTime,
  defaultReturnDateTime,
  readRentBookingPrefs,
  writeRentBookingPrefs,
} from '../../lib/rental/rentBookingSearch.js';

/**
 * Hertz-like rent search bar — themed with rent teal, wired to office locations.
 */
export default function RentBookingSearchBar({
  brandLabel = 'Γραφείο',
  footerAddress = '',
  pickupLocations = [],
  onSearch,
  compact = false,
} = {}) {
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

  return (
    <section className={`rent-search${compact ? ' rent-search--compact' : ''}`} aria-label="Αναζήτηση ενοικίασης">
      <form className="rent-search-panel" onSubmit={handleSubmit}>
        <label className="rent-search-toggle">
          <input
            type="checkbox"
            checked={differentDropoff}
            onChange={(e) => {
              const on = e.target.checked;
              setDifferentDropoff(on);
              if (!on) setDropoffLocation(pickupLocation);
            }}
          />
          <span className="rent-search-switch" aria-hidden />
          <span>Θα παραδώσω σε διαφορετικό σημείο</span>
        </label>

        <div className={`rent-search-row${differentDropoff ? ' rent-search-row--split' : ''}`}>
          <div className="rent-search-field rent-search-field--place">
            <span className="rent-search-field-icon material-symbols-outlined" aria-hidden>
              location_on
            </span>
            <div className="rent-search-field-body">
              <span className="rent-search-label">Σημείο έναρξης ενοικίασης</span>
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
            <span className="rent-search-network" title="Δίκτυο γραφείου">
              <span className="material-symbols-outlined" aria-hidden>
                hub
              </span>
              Δίκτυο
            </span>
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

          <div className="rent-search-field">
            <span className="rent-search-field-icon material-symbols-outlined" aria-hidden>
              calendar_month
            </span>
            <div className="rent-search-field-body">
              <span className="rent-search-label">Πότε θα παραλάβεις;</span>
              <div className="rent-search-datetime">
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
                <input
                  type="time"
                  value={pickupParts.time}
                  onChange={(e) => setStartTime(mergeDateTime(pickupParts.date, e.target.value))}
                  aria-label="Ώρα παραλαβής"
                />
              </div>
            </div>
          </div>

          <div className="rent-search-field">
            <span className="rent-search-field-icon material-symbols-outlined" aria-hidden>
              event_available
            </span>
            <div className="rent-search-field-body">
              <span className="rent-search-label">Πότε θα παραδώσεις;</span>
              <div className="rent-search-datetime">
                <input
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
              </div>
            </div>
          </div>

          <button type="submit" className="rent-search-submit">
            Αναζήτηση
            <span className="material-symbols-outlined" aria-hidden>
              arrow_forward
            </span>
          </button>
        </div>

        <div className="rent-search-footer">
          <label className="rent-search-promo">
            <input
              type="checkbox"
              checked={promoOpen}
              onChange={(e) => setPromoOpen(e.target.checked)}
            />
            <span>Έχεις κωδικό προσφοράς;</span>
          </label>
          {promoOpen ? (
            <input
              className="rent-search-promo-input"
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Κωδικός προσφοράς"
              aria-label="Κωδικός προσφοράς"
            />
          ) : null}
        </div>

        {error ? <p className="rent-search-error">{error}</p> : null}
      </form>
    </section>
  );
}
