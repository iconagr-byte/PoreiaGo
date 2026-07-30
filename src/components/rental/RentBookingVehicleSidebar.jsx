import {
  RENT_INCLUDED_DEFAULTS,
  euroLabel,
} from '../../lib/rental/rentBookingExtras.js';

/**
 * Sticky booking summary sidebar — vehicle, includes, extras, total, CTA.
 */
export default function RentBookingVehicleSidebar({
  vehicle,
  dayCount = 1,
  totals = { vehicle: 0, extras: 0, total: 0 },
  selectedLabels = [],
  busy = false,
  ctaLabel = 'Επόμενο βήμα',
  onChangeVehicle,
  onCta,
  note = 'Το σύνολο (όχημα + extras) καταχωρείται στην κράτηση του γραφείου.',
} = {}) {
  if (!vehicle) return null;

  return (
    <aside className="rent-wiz-side" aria-label="Σύνοψη κράτησης">
      <div className="rent-wiz-side-card">
        <div className="rent-wiz-side-top">
          <h2>Το όχημά μου</h2>
          {typeof onChangeVehicle === 'function' ? (
            <button type="button" onClick={onChangeVehicle}>
              <span className="material-symbols-outlined" aria-hidden>
                swap_horiz
              </span>
              Άλλο όχημα
            </button>
          ) : null}
        </div>

        <div className="rent-wiz-vehicle">
          <div>
            <h3>
              {vehicle.model}
              {vehicle.similar_label ? <em> {vehicle.similar_label}</em> : null}
            </h3>
            <p>{[vehicle.group_code, vehicle.size_label].filter(Boolean).join(' · ')}</p>
            <ul className="rent-wiz-vehicle-specs">
              <li>
                <span className="material-symbols-outlined">group</span>
                {vehicle.seats_label || '—'}
              </li>
              <li>
                <span className="material-symbols-outlined">luggage</span>
                {vehicle.luggage_label || '—'}
              </li>
              <li>
                <span className="material-symbols-outlined">ac_unit</span>
                {vehicle.ac_label || 'A/C'}
              </li>
              <li>
                <span className="material-symbols-outlined">settings</span>
                {vehicle.transmission || '—'}
              </li>
            </ul>
          </div>
          {vehicle.photo_url ? (
            <img src={vehicle.photo_url} alt={vehicle.model || 'Όχημα'} />
          ) : null}
        </div>

        <div className="rent-wiz-includes">
          <h4>Η ενοικίαση περιλαμβάνει</h4>
          <ul>
            {RENT_INCLUDED_DEFAULTS.map((t) => (
              <li key={t}>
                <span className="material-symbols-outlined">check_circle</span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="rent-wiz-selected">
          <h4>Επιλεγμένες υπηρεσίες</h4>
          {selectedLabels.length ? (
            <ul>
              {selectedLabels.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : (
            <p>Δεν προστέθηκαν υπηρεσίες</p>
          )}
        </div>

        <div className="rent-wiz-total">
          <div>
            <span>Συνολικό κόστος</span>
            <small>
              {dayCount} ημέρ. · όχημα {euroLabel(totals.vehicle)}
              {totals.extras > 0 ? ` · extras ${euroLabel(totals.extras)}` : ''}
            </small>
          </div>
          <strong>{euroLabel(totals.total)}</strong>
        </div>

        <button type="button" className="rent-wiz-next" disabled={busy} onClick={onCta}>
          {busy ? 'Καταχώρηση…' : ctaLabel}
        </button>
        {note ? <p className="rent-wiz-note">{note}</p> : null}
      </div>
    </aside>
  );
}
