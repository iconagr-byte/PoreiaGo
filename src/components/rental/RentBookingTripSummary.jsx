import { formatRentWhen } from '../../lib/rental/rentBookingExtras.js';

function shortDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('el-GR', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '—';
  }
}

function shortTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('el-GR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Compact trip strip — one row instead of four stacked cards.
 * Full timestamps stay available via aria-label / title for screen readers.
 */
export default function RentBookingTripSummary({ prefs = {}, onEdit } = {}) {
  const pickup = prefs.pickup_location || '—';
  const dropoff = prefs.dropoff_location || prefs.pickup_location || '—';
  const samePlace = String(pickup).trim() === String(dropoff).trim();
  const placeLine = samePlace ? pickup : `${pickup} → ${dropoff}`;
  const dateLine = `${shortDate(prefs.start_time)} – ${shortDate(prefs.end_time)}`;
  const timeLine = [shortTime(prefs.start_time), shortTime(prefs.end_time)]
    .filter(Boolean)
    .join(' → ');
  const fullLabel = [
    `Παραλαβή: ${pickup}, ${formatRentWhen(prefs.start_time)}`,
    `Παράδοση: ${dropoff}, ${formatRentWhen(prefs.end_time)}`,
  ].join('. ');

  return (
    <div className="rent-wiz-trip rent-wiz-trip--compact">
      <div className="rent-wiz-trip-strip" title={fullLabel} aria-label={fullLabel}>
        <span className="material-symbols-outlined rent-wiz-trip-strip-icon" aria-hidden>
          location_on
        </span>
        <div className="rent-wiz-trip-strip-copy">
          <strong>{placeLine}</strong>
          <span>
            {dateLine}
            {timeLine ? ` · ${timeLine}` : ''}
          </span>
        </div>
        {typeof onEdit === 'function' ? (
          <button type="button" className="rent-wiz-trip-strip-edit" onClick={onEdit}>
            Αλλαγή
          </button>
        ) : null}
      </div>
    </div>
  );
}
