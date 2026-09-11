/**
 * My Wallet home — boarding pass(es). Multi-seat bookings get one QR per traveler
 * (airline-style), still under a single booker wallet account.
 */
import { Link } from 'react-router-dom';
import TicketQrCode from '../TicketQrCode.jsx';
import PassengerTrackCTA from '../passenger/PassengerTrackCTA.jsx';
import WalletDeviceSave from './WalletDeviceSave.jsx';
import { isPaid, statusStyle } from '../../lib/bookingDisplay.js';
import { bookingFiscalMark } from '../../lib/fiscal/fiscalDisplay.js';
import { getBookingPassengers } from '../../lib/ticketing/bookingPassengers.js';

function formatTripWhen(booking) {
  const date = booking?.date || '—';
  const time = booking?.time || '';
  return time ? `${date} · ${time}` : date;
}

function PassengerTicketCard({
  booking,
  passenger,
  coverImage,
  brandLabel,
  paid,
  status,
  pnr,
  mark,
  offline,
  onOpenDetails,
  onQrChange,
  showActions,
}) {
  const seatBooking = {
    ...booking,
    seat: passenger.seat || booking.seat,
    seats: passenger.seat ? [passenger.seat] : booking.seats,
    customerName: passenger.name || booking.customerName,
    passengerName: passenger.name || booking.passengerName,
  };

  return (
    <article className="wallet-pass-card wallet-pass-card-enter" aria-label={`Εισιτήριο ${passenger.name || passenger.seat}`}>
      <div className="wallet-pass-card-top">
        <div className="min-w-0">
          <p className="wallet-pass-kicker">
            {passenger.role === 'booker' ? 'Επιβάτης · αγοραστής' : 'Επιβάτης'}
          </p>
          <p className="wallet-pass-passenger truncate">{passenger.name || '—'}</p>
        </div>
        <span className={`wallet-pass-status ${status.className}`}>
          {booking.status || (paid ? 'Πληρωμένο' : '—')}
        </span>
      </div>

      <div className="wallet-pass-meta">
        <div>
          <p className="wallet-pass-kicker">Θέση</p>
          <p className="wallet-pass-meta-value">{passenger.seat || '—'}</p>
        </div>
        <div>
          <p className="wallet-pass-kicker">Κωδικός</p>
          <p className="wallet-pass-meta-value wallet-pass-mono">{pnr}</p>
        </div>
        <div>
          <p className="wallet-pass-kicker">Ποσό</p>
          <p className="wallet-pass-meta-value">
            {showActions ? `€${Number(booking.price || 0).toFixed(2)}` : '—'}
          </p>
        </div>
      </div>

      <div className="wallet-pass-perforation" aria-hidden>
        <span />
        <span />
      </div>

      <div className={`wallet-pass-qr-wrap${paid && !offline ? ' is-live' : ''}`}>
        {offline && booking._offlineQrDataUrl && showActions ? (
          <div className="bg-white p-3 rounded-2xl wallet-pass-qr">
            <img src={booking._offlineQrDataUrl} alt="QR εισιτηρίου" width={168} height={168} />
          </div>
        ) : (
          <TicketQrCode
            booking={seatBooking}
            size={168}
            className="wallet-pass-qr"
            onQrChange={showActions ? onQrChange : undefined}
          />
        )}
        <p className="wallet-pass-qr-hint">
          {offline
            ? 'Χωρίς σύνδεση · τελευταίο αποθηκευμένο QR'
            : paid
              ? `Δείξτε το QR για τη θέση ${passenger.seat || ''} στον οδηγό`
              : 'Το QR ενεργοποιείται μετά την πληρωμή'}
        </p>
        {mark ? <p className="wallet-pass-mark">MARK {mark}</p> : null}
      </div>

      {showActions ? (
        <div className="wallet-pass-actions">
          <WalletDeviceSave booking={seatBooking} />
          {paid && booking.tripId ? (
            <PassengerTrackCTA booking={booking} showEta={false} />
          ) : (
            <button type="button" className="wallet-pass-cta" onClick={() => onOpenDetails?.(booking)}>
              Λεπτομέρειες κράτησης
            </button>
          )}
          <div className="wallet-pass-secondary-row">
            <button
              type="button"
              className="wallet-pass-secondary"
              onClick={() => onOpenDetails?.(booking)}
            >
              Λεπτομέρειες
            </button>
            <Link
              to={`/ticket/print/${encodeURIComponent(booking.id)}?print=1`}
              className="wallet-pass-secondary"
            >
              PDF
            </Link>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function WalletBoardingPass({
  booking,
  coverImage,
  brandLabel = 'My Wallet',
  passengerName = '',
  onOpenDetails,
  onBrowseTrips,
  onQrChange,
  offline = false,
}) {
  if (!booking) {
    return (
      <section className="wallet-pass-empty">
        <div className="wallet-pass-empty-inner">
          <span className="material-symbols-outlined wallet-pass-empty-icon" aria-hidden>
            confirmation_number
          </span>
          <h2 className="wallet-pass-empty-title">Δεν έχετε ακόμα εισιτήριο</h2>
          <p className="wallet-pass-empty-copy">
            Κάντε κράτηση στο site — μετά την πληρωμή δημιουργείτε My Wallet και εμφανίζεται εδώ το
            QR επιβίβασης.
          </p>
          <button type="button" className="wallet-pass-cta" onClick={onBrowseTrips}>
            Δείτε εκδρομές
            <span className="material-symbols-outlined" aria-hidden>
              arrow_forward
            </span>
          </button>
          <Link to="/my-booking" className="wallet-pass-empty-secondary">
            Έχω ήδη κωδικό κράτησης
          </Link>
        </div>
      </section>
    );
  }

  const paid = isPaid(booking);
  const st = statusStyle(booking);
  const pnr = booking.pnr || booking.id;
  const mark = bookingFiscalMark(booking);
  let party = getBookingPassengers(booking);
  if (!party.length) {
    party = [
      {
        seat: booking.seat || (Array.isArray(booking.seats) ? booking.seats[0] : '') || '',
        name:
          passengerName ||
          booking.customerName ||
          booking.passengerName ||
          booking.name ||
          '—',
        role: 'booker',
      },
    ];
  } else if (passengerName && party[0]?.role === 'booker' && !party[0].name) {
    party = [{ ...party[0], name: passengerName }, ...party.slice(1)];
  }

  return (
    <section className="wallet-pass" aria-label="Εισιτήρια επιβίβασης">
      <div
        className="wallet-pass-hero"
        style={{ backgroundImage: coverImage ? `url(${coverImage})` : undefined }}
      >
        <div className="wallet-pass-hero-shade" aria-hidden />
        <div className="wallet-pass-hero-copy">
          <p className="wallet-pass-brand">{brandLabel}</p>
          <h1 className="wallet-pass-title">{booking.tripTitle || 'Εκδρομή'}</h1>
          <p className="wallet-pass-when">{formatTripWhen(booking)}</p>
          {party.length > 1 ? (
            <p className="wallet-pass-party-count">{party.length} ξεχωριστά εισιτήρια · 1 QR ανά επιβάτη</p>
          ) : null}
        </div>
      </div>

      <div className={`wallet-pass-stack${party.length > 1 ? ' is-multi' : ''}`}>
        {party.map((p, index) => (
          <PassengerTicketCard
            key={`${p.seat}-${p.name}-${index}`}
            booking={booking}
            passenger={p}
            coverImage={coverImage}
            brandLabel={brandLabel}
            paid={paid}
            status={st}
            pnr={pnr}
            mark={index === 0 ? mark : null}
            offline={offline}
            onOpenDetails={onOpenDetails}
            onQrChange={onQrChange}
            showActions={index === 0}
          />
        ))}
      </div>
    </section>
  );
}
