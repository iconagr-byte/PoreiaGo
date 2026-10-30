import StaticTicketQr from '../StaticTicketQr.jsx';
import { isPaid } from '../../lib/bookingDisplay.js';
import { getBookingPassengers } from '../../lib/ticketing/bookingPassengers.js';
import '../../styles/personal-ticket-pass.css';

/** One QR / print identity per seat (wallet-style personal ticket). */
export function seatScopedBooking(booking, passenger) {
  if (!booking || !passenger) return booking;
  const seat = String(passenger.seat || '').trim();
  return {
    ...booking,
    seat: seat || booking.seat,
    seats: seat ? [seat] : booking.seats,
    customerName: passenger.name || booking.customerName,
    passengerName: passenger.name || booking.passengerName,
  };
}

function formatTripWhen(booking) {
  const date = booking?.date || '—';
  const time = String(booking?.time || '').trim();
  return time ? `${date} · ${time}` : date;
}

function passengerLabel(passenger, booking) {
  const name = String(passenger?.name || '').trim();
  if (name) return name;
  if (passenger?.role === 'booker') {
    return booking?.customerName || booking?.passengerName || 'Αγοραστής';
  }
  return 'Συνοδός';
}

/**
 * Apple Wallet–style boarding pass for one seat / passenger.
 * Vertical layout: trip → passenger/seat/meta → QR (nothing overlaps).
 */
export function PersonalTicketPass({
  booking,
  passenger,
  compact = false,
  qrSize,
  showBoarding = true,
  brandLabel = 'Εισιτήριο',
}) {
  if (!booking || !passenger) return null;

  const paid = isPaid(booking);
  const seatBooking = seatScopedBooking(booking, passenger);
  const name = passengerLabel(passenger, booking);
  const pnr = booking.pnr || booking.ticketRef || booking.id;
  const checkedIn =
    booking.checkedIn ||
    booking.checkInStatus === 'CHECKED_IN' ||
    booking.checkInStatus === 'BOARDED';
  const size = qrSize ?? (compact ? 88 : 96);
  const roleHint =
    passenger.role === 'booker' ? 'Αγοραστής' : passenger.role === 'companion' ? 'Συνοδός' : null;

  return (
    <article
      className={['ptp-pass', compact ? 'is-compact' : ''].filter(Boolean).join(' ')}
      aria-label={`Εισιτήριο ${name}${passenger.seat ? ` · θέση ${passenger.seat}` : ''}`}
    >
      <header className="ptp-pass-hero">
        <div className="ptp-pass-hero-row">
          <div className="ptp-pass-hero-top">
            <p className="ptp-pass-brand">{brandLabel}</p>
            <span className={`ptp-pass-status${paid ? '' : ' is-pending'}`}>
              {paid ? booking.status || 'Πληρωμένο' : 'Εκκρεμεί'}
            </span>
          </div>
          <div>
            <h3 className="ptp-pass-trip">{booking.tripTitle || 'Εκδρομή'}</h3>
            <p className="ptp-pass-when">{formatTripWhen(booking)}</p>
          </div>
        </div>
      </header>

      <div className="ptp-pass-body">
        <div className="ptp-pass-main">
          <div className="ptp-pass-fields">
            <div className="min-w-0">
              <p className="ptp-field-label">Επιβάτης</p>
              <p className="ptp-field-value">{name}</p>
              {roleHint ? <p className="ptp-field-hint">{roleHint}</p> : null}
            </div>
            <div>
              <p className="ptp-field-label" style={{ textAlign: 'right' }}>
                Θέση
              </p>
              <p className="ptp-field-value is-seat">{passenger.seat || '—'}</p>
            </div>
          </div>

          <div className="ptp-meta-row">
            <div>
              <p className="ptp-field-label">Ημερομηνία</p>
              <p className="ptp-field-value">{booking.date || '—'}</p>
            </div>
            <div>
              <p className="ptp-field-label">Ώρα</p>
              <p className="ptp-field-value">{booking.time || '—'}</p>
            </div>
            <div>
              <p className="ptp-field-label">Κωδικός</p>
              <p className="ptp-field-value is-mono">{pnr}</p>
            </div>
          </div>
        </div>

        <div className="ptp-perforation" aria-hidden>
          <span />
          <span />
        </div>

        <div className="ptp-qr-col">
          <div className="ptp-qr-frame">
            <StaticTicketQr booking={seatBooking} size={size} />
          </div>
          {showBoarding ? (
            <div className={`ptp-board${checkedIn ? ' is-done' : ''}`}>
              <span className="material-symbols-outlined" aria-hidden>
                {checkedIn ? 'check_circle' : 'pending'}
              </span>
              {checkedIn ? 'Επιβιβάστηκε' : 'Εκκρεμεί επιβίβαση'}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/**
 * Stack of personal passes for a booking (one full-width pass per seat).
 */
export default function PersonalTicketPassList({
  booking,
  compact = false,
  qrSize,
  brandLabel,
  heading = true,
}) {
  if (!booking) return null;
  const passengers = getBookingPassengers(booking);
  const list =
    passengers.length > 0
      ? passengers
      : [
          {
            seat: booking.seat || '',
            name: booking.customerName || booking.passengerName || '',
            role: 'booker',
          },
        ];
  const pnr = booking.pnr || booking.ticketRef || booking.id;
  const multi = list.length > 1;

  return (
    <div className="ptp-stack">
      {heading ? (
        <div className="ptp-stack-head">
          <p className="ptp-stack-kicker">
            {multi ? 'Προσωπικά εισιτήρια' : 'Εισιτήριο επιβίβασης'}
          </p>
          <p className="ptp-stack-title">
            {multi
              ? `${list.length} θέσεις · ένα QR ανά επιβάτη`
              : 'Δείξτε το QR στον οδηγό'}
          </p>
          <p className="ptp-stack-sub font-mono">{pnr}</p>
        </div>
      ) : null}
      <div className="ptp-grid">
        {list.map((passenger, index) => (
          <PersonalTicketPass
            key={`${passenger.seat || 'seat'}-${index}`}
            booking={booking}
            passenger={passenger}
            compact={compact}
            qrSize={qrSize}
            brandLabel={brandLabel}
          />
        ))}
      </div>
    </div>
  );
}
