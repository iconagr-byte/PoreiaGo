/**
 * Step 2 — customer ticket detail (boarding-pass style, not admin panel).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import TicketQrCode from '../TicketQrCode.jsx';
import PassengerTrackCTA from '../passenger/PassengerTrackCTA.jsx';
import WalletDeviceSave from './WalletDeviceSave.jsx';
import { useCustomerFiscalPoll } from '../../lib/fiscal/useCustomerFiscalPoll.js';
import { isPaid, statusStyle, parsePaymentMethod, hasDepositBalance } from '../../lib/bookingDisplay.js';
import { bookingFiscalMark } from '../../lib/fiscal/fiscalDisplay.js';
import { fiscalReceiptPrintPath } from '../../lib/fiscal/fiscalReceiptPrint.js';
import { sendTicketEmail } from '../../services/ticketingApi.js';
import { ticketPrintPath } from '../../lib/ticketing/printTicket.js';

function tripImageFor(booking, coverImage) {
  return coverImage || '/images/hero-bus-achillio.png';
}

export default function WalletTicketDetail({
  booking,
  coverImage = '',
  brandLabel = 'My Wallet',
  passengerName = '',
  onBack,
  onBookingUpdated,
}) {
  const [emailSending, setEmailSending] = useState(false);

  if (!booking) return null;

  const paid = isPaid(booking);
  const st = statusStyle(booking);
  const pay = parsePaymentMethod(booking);
  const pnr = booking.pnr || booking.ticketRef || booking.id;
  const mark = bookingFiscalMark(booking);
  const price = Number(booking.price || 0);
  const seats = booking.seat || booking.seats || '—';
  const name = passengerName || booking.passengerName || booking.customerName || booking.name || '—';
  const cover = tripImageFor(booking, coverImage);

  useCustomerFiscalPoll(booking, {
    enabled: paid,
    onUpdated: onBookingUpdated,
  });

  const handleEmail = async () => {
    const email = String(booking.email || '').trim();
    if (!email) {
      toast.error('Δεν υπάρχει email σε αυτή την κράτηση');
      return;
    }
    setEmailSending(true);
    try {
      const result = await sendTicketEmail(booking);
      if (result.logged_only) {
        toast.success(`Καταγράφηκε αποστολή — ${result.email}`);
      } else {
        toast.success(`Στάλθηκε στο ${result.email}`);
      }
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποστολής');
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className="wallet-ticket">
      <button type="button" className="wallet-ticket-back" onClick={onBack}>
        <span className="material-symbols-outlined" aria-hidden>
          arrow_back
        </span>
        Πίσω στο εισιτήριο
      </button>

      <section className="wallet-pass" aria-label="Λεπτομέρειες εισιτηρίου">
        <div className="wallet-pass-hero" style={{ backgroundImage: `url(${cover})` }}>
          <div className="wallet-pass-hero-shade" aria-hidden />
          <div className="wallet-pass-hero-copy">
            <p className="wallet-pass-brand">{brandLabel}</p>
            <h1 className="wallet-pass-title">{booking.tripTitle || 'Εκδρομή'}</h1>
            <p className="wallet-pass-when">
              {booking.date || '—'}
              {booking.time ? ` · ${booking.time}` : ''}
            </p>
          </div>
        </div>

        <div className="wallet-pass-card wallet-pass-card-enter">
          <div className="wallet-pass-card-top">
            <div className="min-w-0">
              <p className="wallet-pass-kicker">Επιβάτης</p>
              <p className="wallet-pass-passenger truncate">{name}</p>
            </div>
            <span className={`wallet-pass-status ${st.className}`}>
              {booking.status || (paid ? 'Πληρωμένο' : '—')}
            </span>
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
              <p className="wallet-pass-meta-value">€{price.toFixed(2)}</p>
            </div>
          </div>

          <div className="wallet-pass-perforation" aria-hidden>
            <span />
            <span />
          </div>

          <div className={`wallet-pass-qr-wrap${paid ? ' is-live' : ''}`}>
            <TicketQrCode booking={booking} size={180} className="wallet-pass-qr" />
            <p className="wallet-pass-qr-hint">
              {paid
                ? 'Δείξτε το QR στον οδηγό κατά την επιβίβαση'
                : 'Το QR ενεργοποιείται μετά την πληρωμή'}
            </p>
            {booking.checkedIn ? (
              <p className="wallet-ticket-boarded">
                <span className="material-symbols-outlined" aria-hidden>
                  check_circle
                </span>
                Επιβιβάστηκε
              </p>
            ) : (
              <p className="wallet-ticket-pending-board">
                <span className="material-symbols-outlined" aria-hidden>
                  pending
                </span>
                Εκκρεμεί επιβίβαση
              </p>
            )}
            {mark ? <p className="wallet-pass-mark">MARK {mark}</p> : null}
          </div>

          {paid && booking.tripId ? (
            <div className="wallet-ticket-track">
              <PassengerTrackCTA booking={booking} showEta />
            </div>
          ) : null}
        </div>
      </section>

      <section className="wallet-ticket-panel">
        <h2>Πληρωμή</h2>
        <dl className="wallet-ticket-dl">
          <div>
            <dt>Κατάσταση</dt>
            <dd>{paid ? 'Εξοφλήθηκε' : 'Εκκρεμεί'}</dd>
          </div>
          <div>
            <dt>Τρόπος</dt>
            <dd className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-slate-500">
                {pay.icon}
              </span>
              {booking.paymentMethod || pay.label}
            </dd>
          </div>
          {hasDepositBalance(booking) ? (
            <>
              <div>
                <dt>Πληρώθηκε</dt>
                <dd>€{Number(booking.amountPaid || 0).toFixed(2)}</dd>
              </div>
              <div>
                <dt>Υπόλοιπο στο λεωφορείο</dt>
                <dd className="text-amber-700">€{Number(booking.balanceDue || 0).toFixed(2)}</dd>
              </div>
            </>
          ) : null}
        </dl>
        {mark ? (
          <Link to={fiscalReceiptPrintPath(booking.id)} className="wallet-ticket-link">
            <span className="material-symbols-outlined" aria-hidden>
              receipt_long
            </span>
            Απόδειξη / τιμολόγιο
          </Link>
        ) : null}
      </section>

      <section className="wallet-ticket-panel">
        <h2>Στοιχεία επικοινωνίας</h2>
        <dl className="wallet-ticket-dl">
          <div>
            <dt>Email</dt>
            <dd>{booking.email || '—'}</dd>
          </div>
          <div>
            <dt>Τηλέφωνο</dt>
            <dd>{booking.phone || '—'}</dd>
          </div>
          {booking.luggage ? (
            <div>
              <dt>Αποσκευές</dt>
              <dd>{booking.luggage}</dd>
            </div>
          ) : null}
          {booking.dietary ? (
            <div>
              <dt>Διατροφή</dt>
              <dd>{booking.dietary}</dd>
            </div>
          ) : null}
          {Array.isArray(booking.extras) && booking.extras.length > 0 ? (
            <div className="sm:col-span-2">
              <dt>Υπηρεσίες</dt>
              <dd>
                <ul className="mt-1 space-y-1">
                  {booking.extras.map((line) => (
                    <li key={line.id || line.formKey || line.title}>
                      {line.title}
                      {line.qty > 1 ? ` × ${line.qty}` : ''}
                      {' · '}€{Number(line.lineTotalEur || 0).toFixed(2)}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <div className="wallet-ticket-actions">
        <WalletDeviceSave booking={booking} />
        <Link to={ticketPrintPath(booking.id, { autoPrint: true })} className="wallet-pass-cta">
          <span className="material-symbols-outlined" aria-hidden>
            print
          </span>
          Εκτύπωση / PDF
        </Link>
        <button
          type="button"
          className="wallet-pass-secondary wallet-ticket-email"
          onClick={handleEmail}
          disabled={emailSending}
        >
          <span className="material-symbols-outlined" aria-hidden>
            {emailSending ? 'hourglass_empty' : 'mail'}
          </span>
          {emailSending ? 'Αποστολή…' : 'Αποστολή στο email'}
        </button>
      </div>
    </div>
  );
}
