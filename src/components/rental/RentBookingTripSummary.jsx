import { formatRentWhen } from '../../lib/rental/rentBookingExtras.js';

export default function RentBookingTripSummary({ prefs = {}, onEdit } = {}) {
  const cards = [
    {
      icon: 'location_on',
      title: 'Πού θα παραλάβεις;',
      value: prefs.pickup_location || '—',
    },
    {
      icon: 'calendar_month',
      title: 'Πότε θα παραλάβεις;',
      value: formatRentWhen(prefs.start_time),
    },
    {
      icon: 'location_on',
      title: 'Πού θα παραδώσεις;',
      value: prefs.dropoff_location || prefs.pickup_location || '—',
    },
    {
      icon: 'calendar_month',
      title: 'Πότε θα παραδώσεις;',
      value: formatRentWhen(prefs.end_time),
    },
  ];

  return (
    <div className="rent-wiz-trip">
      <div className="rent-wiz-trip-grid">
        {cards.map((c) => (
          <article key={c.title} className="rent-wiz-trip-card">
            <span className="material-symbols-outlined" aria-hidden>
              {c.icon}
            </span>
            <div>
              <p>{c.title}</p>
              <strong>{c.value}</strong>
            </div>
          </article>
        ))}
      </div>
      {typeof onEdit === 'function' ? (
        <button type="button" className="rent-wiz-edit" onClick={onEdit}>
          <span className="material-symbols-outlined" aria-hidden>
            edit_note
          </span>
          Αλλάζω στοιχεία
        </button>
      ) : null}
    </div>
  );
}
