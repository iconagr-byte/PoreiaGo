import { useEffect } from 'react';
import { enrichRentVehicle } from '../../lib/rental/rentFleetEnrichment.js';

function vehiclePhotos(v) {
  const urls = v?.photo_urls?.length ? v.photo_urls : v?.photo_url ? [v.photo_url] : [];
  return [...new Set(urls.filter(Boolean))];
}

/**
 * Bottom sheet: gallery + rental specs for a fleet pick card.
 */
export default function RentVehicleDetailSheet({
  vehicle,
  onClose,
  onSelect,
  selectLabel = 'Επιλογή οχήματος',
}) {
  const v = enrichRentVehicle(vehicle);
  const photos = vehiclePhotos(v);
  const groupLine = [v.group_code, v.size_label].filter(Boolean).join(' · ');

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

  if (!vehicle) return null;

  const facts = [
    { icon: 'group', label: v.seats_label || `${v.seating_capacity || '—'} επιβάτες` },
    { icon: 'luggage', label: v.luggage_label || v.luggage || 'Αποσκευές' },
    { icon: 'ac_unit', label: v.ac_label || 'Με κλιματισμό' },
    { icon: 'settings', label: v.transmission || 'Με ταχύτητες' },
    v.fuel ? { icon: 'local_gas_station', label: v.fuel } : null,
    v.doors ? { icon: 'sensor_door', label: `${v.doors} πόρτες` } : null,
  ].filter(Boolean);

  return (
    <div
      className="rent-sheet-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={v.model || 'Λεπτομέρειες οχήματος'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="rent-sheet rent-sheet--detail">
        <div className="rent-sheet-head">
          <div className="rent-sheet-head-copy">
            <h3>{v.model || 'Όχημα'}</h3>
            {v.similar_label ? <p className="rent-sheet-similar">{v.similar_label}</p> : null}
          </div>
          <button type="button" className="rent-btn rent-btn-ghost" onClick={onClose}>
            Κλείσιμο
          </button>
        </div>

        <div className={`rent-sheet-gallery${photos.length === 1 ? ' is-single' : ''}`}>
          {photos.length ? (
            photos.map((url) => (
              <img key={url} src={url} alt={v.model || 'Όχημα'} loading="lazy" />
            ))
          ) : (
            <div className="rent-vehicle-placeholder">
              <span className="material-symbols-outlined">directions_car</span>
            </div>
          )}
        </div>

        <div className="rent-sheet-body">
          {groupLine ? <p className="rent-sheet-group">{groupLine}</p> : null}
          {v.price_label ? <p className="rent-sheet-price">{v.price_label}</p> : null}
          {v.display_headline ? <p className="rent-sheet-headline">{v.display_headline}</p> : null}
          <p>
            {v.display_blurb ||
              v.description ||
              'Καθαρό, ασφαλές και έτοιμο για παραλαβή. Περιλαμβάνει βασική ασφάλεια σύμφωνα με τους όρους μίσθωσης του γραφείου.'}
          </p>

          <ul className="rent-sheet-facts">
            {facts.map((f) => (
              <li key={`${f.icon}-${f.label}`}>
                <span className="material-symbols-outlined" aria-hidden>
                  {f.icon}
                </span>
                <span>{f.label}</span>
              </li>
            ))}
          </ul>

          {Array.isArray(v.highlights) && v.highlights.length ? (
            <ul className="rent-sheet-tags">
              {v.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          ) : null}

          <div className="rent-sheet-terms">
            <p>
              <strong>Μίσθωση:</strong> ημερήσια χρέωση σύμφωνα με το τιμολόγιο · καύσιμα &
              χιλιόμετρα βάσει πολιτικής γραφείου · απαιτείται έγκυρη άδεια οδήγησης.
            </p>
          </div>

          {onSelect ? (
            <button
              type="button"
              className="rent-pick-cta rent-sheet-cta"
              onClick={() => {
                onSelect(vehicle);
                onClose?.();
              }}
            >
              {selectLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
