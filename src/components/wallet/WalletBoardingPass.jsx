/**
 * Step 1 My Wallet home — one boarding pass as the hero composition.
 */
import { Link } from 'react-router-dom';
import TicketQrCode from '../TicketQrCode.jsx';
import PassengerTrackCTA from '../passenger/PassengerTrackCTA.jsx';
import { isPaid, statusStyle } from '../../lib/bookingDisplay.js';
import { bookingFiscalMark } from '../../lib/fiscal/fiscalDisplay.js';

function formatTripWhen(booking) {
  const date = booking?.date || '—';
  const time = booking?.time || '';
  return time ? `${date} · ${time}` : date;
}

export default function WalletBoardingPass({
  booking,
  coverImage,
  brandLabel = 'My Wallet',
  passengerName = '',
  onOpenDetails,
  onBrowseTrips,
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
  const seats = booking.seat || booking.seats || '—';

  return (
    <section className="wallet-pass" aria-label="Εισιτήριο επιβίβασης">
      <div
        className="wallet-pass-hero"
        style={{ backgroundImage: coverImage ? `url(${coverImage})` : undefined }}
      >
        <div className="wallet-pass-hero-shade" aria-hidden />
        <div className="wallet-pass-hero-copy">
          <p className="wallet-pass-brand">{brandLabel}</p>
          <h1 className="wallet-pass-title">{booking.tripTitle || 'Εκδρομή'}</h1>
          <p className="wallet-pass-when">{formatTripWhen(booking)}</p>
        </div>
      </div>

      <div className="wallet-pass-card wallet-pass-card-enter">
        <div className="wallet-pass-card-top">
          <div className="min-w-0">
            <p className="wallet-pass-kicker">Επιβάτης</p>
            <p className="wallet-pass-passenger truncate">
              {passengerName || booking.passengerName || booking.name || '—'}
            </p>
          </div>
          <span className={`wallet-pass-status ${st.className}`}>{booking.status || (paid ? 'Πληρωμένο' : '—')}</span>
        </div>

        <div className="wallet-pass-meta">
          <div>
            <p className="wallet-pass-kicker">Θέση</p>
            <p className="wallet-pass-meta-value">{seats}</p>
          </div>
          <div>
            <p className="wallet-pass-kicker">Κωδικός</p>
            <p className="wallet-pass-meta-value wallet-pass-mono">{pnr}</p>
          </div>
          <div>
            <p className="wallet-pass-kicker">Ποσό</p>
            <p className="wallet-pass-meta-value">€{Number(booking.price || 0).toFixed(2)}</p>
          </div>
        </div>

        <div className="wallet-pass-perforation" aria-hidden>
          <span />
          <span />
        </div>

        <div className={`wallet-pass-qr-wrap${paid ? ' is-live' : ''}`}>
          <TicketQrCode booking={booking} size={168} className="wallet-pass-qr" />
          <p className="wallet-pass-qr-hint">
            {paid
              ? 'Δείξτε το QR στον οδηγό κατά την επιβίβαση'
              : 'Το QR ενεργοποιείται μετά την πληρωμή'}
          </p>
          {mark ? <p className="wallet-pass-mark">MARK {mark}</p> : null}
        </div>

        <div className="wallet-pass-actions">
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
            <Link to={`/ticket/print/${encodeURIComponent(booking.id)}`} className="wallet-pass-secondary">
              Εκτύπωση
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
