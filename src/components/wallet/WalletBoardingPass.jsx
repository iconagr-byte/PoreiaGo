/**
 * Step 1 My Wallet home — one boarding pass as the hero composition.
 */
import { Link } from 'react-router-dom';
import TicketQrCode from '../TicketQrCode.jsx';
import PassengerTrackCTA from '../passenger/PassengerTrackCTA.jsx';
import WalletDeviceSave from './WalletDeviceSave.jsx';
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
  onOpenBookings,
  onOpenRent,
  onQrChange,
  offline = false,
}) {
  if (!booking) {
    return (
      <section className="wallet-pass-empty" aria-label="My Wallet">
        <div className="wallet-pass-empty-visual" aria-hidden>
          <div className="wallet-pass-empty-orb" />
          <div className="wallet-pass-empty-faux">
            <span className="wallet-pass-empty-faux-brand">Board</span>
            <span className="material-symbols-outlined wallet-pass-empty-faux-qr">qr_code_2</span>
            <span className="wallet-pass-empty-faux-line" />
            <span className="wallet-pass-empty-faux-line wallet-pass-empty-faux-line--short" />
          </div>
        </div>

        <div className="wallet-pass-empty-inner">
          <p className="wallet-pass-empty-kicker">My Wallet</p>
          <h2 className="wallet-pass-empty-title">Το εισιτήριό σας,<br />πάντα μαζί σας</h2>
          <p className="wallet-pass-empty-copy">
            Κλείστε εκδρομή ή προσθέστε υπάρχουσα κράτηση — το QR επιβίβασης εμφανίζεται εδώ, έτοιμο
            για τον οδηγό.
          </p>

          <button type="button" className="wallet-pass-cta" onClick={onBrowseTrips}>
            Δείτε εκδρομές
            <span className="material-symbols-outlined" aria-hidden>
              arrow_forward
            </span>
          </button>

          <Link to="/my-booking" className="wallet-pass-empty-secondary">
            <span className="material-symbols-outlined" aria-hidden>
              confirmation_number
            </span>
            Έχω ήδη κωδικό κράτησης
          </Link>

          <div className="wallet-pass-empty-shortcuts">
            <button type="button" className="wallet-pass-empty-chip" onClick={onOpenBookings}>
              <span className="material-symbols-outlined" aria-hidden>
                event_note
              </span>
              Κρατήσεις
            </button>
            <button type="button" className="wallet-pass-empty-chip" onClick={onOpenRent}>
              <span className="material-symbols-outlined" aria-hidden>
                directions_car
              </span>
              Ενοικίαση
            </button>
          </div>

          <ol className="wallet-pass-empty-steps">
            <li>
              <span>1</span>
              Κράτηση
            </li>
            <li>
              <span>2</span>
              Wallet
            </li>
            <li>
              <span>3</span>
              QR
            </li>
          </ol>
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

        <div className={`wallet-pass-qr-wrap${paid && !offline ? ' is-live' : ''}`}>
          {offline && booking._offlineQrDataUrl ? (
            <div className="bg-white p-3 rounded-2xl wallet-pass-qr">
              <img
                src={booking._offlineQrDataUrl}
                alt="QR εισιτηρίου"
                width={168}
                height={168}
              />
            </div>
          ) : (
            <TicketQrCode
              booking={booking}
              size={168}
              className="wallet-pass-qr"
              onQrChange={onQrChange}
            />
          )}
          <p className="wallet-pass-qr-hint">
            {offline
              ? 'Χωρίς σύνδεση · τελευταίο αποθηκευμένο QR'
              : paid
                ? 'Δείξτε το QR στον οδηγό κατά την επιβίβαση'
                : 'Το QR ενεργοποιείται μετά την πληρωμή'}
          </p>
          {mark ? <p className="wallet-pass-mark">MARK {mark}</p> : null}
        </div>

        <div className="wallet-pass-actions">
          <WalletDeviceSave booking={booking} />
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
      </div>
    </section>
  );
}
