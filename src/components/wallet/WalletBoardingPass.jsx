/**
 * My Wallet home — boarding pass(es). Multi-seat bookings get one QR per traveler
 * (airline-style), still under a single booker wallet account.
 *
 * Phone / native / desktop: classic Apple Wallet vertical stack —
 * back passes show only a header peek; tap to bring that pass to the front
 * (expands QR + actions). Tickets stay chronological — earliest departure first
 * (see expandWalletTickets sort).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import TicketQrCode from '../TicketQrCode.jsx';
import PassengerTrackCTA from '../passenger/PassengerTrackCTA.jsx';
import WalletDeviceSave from './WalletDeviceSave.jsx';
import { isPaid, statusStyle } from '../../lib/bookingDisplay.js';
import { bookingFiscalMark } from '../../lib/fiscal/fiscalDisplay.js';
import { expandWalletTickets } from '../../lib/ticketing/bookingPassengers.js';

function formatTripWhen(booking) {
  const date = booking?.date || '—';
  const time = booking?.time || '';
  return time ? `${date} · ${time}` : date;
}

function seatBookingFor(booking, passenger) {
  return {
    ...booking,
    seat: passenger.seat || booking.seat,
    seats: passenger.seat ? [passenger.seat] : booking.seats,
    customerName: passenger.name || booking.customerName,
    passengerName: passenger.name || booking.passengerName,
  };
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
  showQr = true,
  compactHeader = false,
  isFront = true,
  onSelect,
  stackIndex = 0,
  stackTotal = 1,
}) {
  const seatBooking = seatBookingFor(booking, passenger);
  const peekOnly = !isFront && compactHeader;

  return (
    <article
      className={[
        'wallet-pass-card',
        'wallet-pass-card-enter',
        isFront ? 'is-front' : 'is-peek',
        peekOnly ? 'is-peek-collapsed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`Εισιτήριο ${passenger.name || passenger.seat}`}
      aria-current={isFront ? 'true' : undefined}
      data-stack-index={stackIndex}
      data-stack-total={stackTotal}
      onClick={onSelect && !isFront ? onSelect : undefined}
      onKeyDown={
        onSelect && !isFront
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      role={onSelect && !isFront ? 'button' : undefined}
      tabIndex={onSelect && !isFront ? 0 : undefined}
    >
      {compactHeader ? (
        <div
          className="wallet-pass-card-hero"
          style={{ backgroundImage: coverImage ? `url(${coverImage})` : undefined }}
        >
          <div className="wallet-pass-card-hero-shade" aria-hidden />
          <div className="wallet-pass-card-hero-copy">
            <p className="wallet-pass-brand">{brandLabel}</p>
            <h2 className="wallet-pass-card-trip truncate">{booking.tripTitle || 'Εκδρομή'}</h2>
            <p className="wallet-pass-when">{formatTripWhen(booking)}</p>
          </div>
          {!isFront ? (
            <span className="wallet-pass-peek-seat" aria-hidden>
              {passenger.seat || '·'}
            </span>
          ) : null}
        </div>
      ) : null}

      {!peekOnly ? (
        <>
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

          {showQr ? (
            <>
              <div className="wallet-pass-perforation" aria-hidden>
                <span />
                <span />
              </div>

              <div className={`wallet-pass-qr-wrap${paid && !offline ? ' is-live' : ''}`}>
                {offline && booking._offlineQrDataUrl && showActions ? (
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
            </>
          ) : null}

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
        </>
      ) : null}
    </article>
  );
}

function WalletEmptyHorizon({ brandLabel }) {
  return (
    <div className="wallet-pass-empty-art" aria-hidden>
      <svg viewBox="0 0 640 220" xmlns="http://www.w3.org/2000/svg" focusable="false">
        <defs>
          <linearGradient id="walletEmptySky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7eb6ff" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#c8dff8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#eef4fb" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="walletEmptySea" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0a4a8a" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#0071e3" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#0a2540" stopOpacity="0.18" />
          </linearGradient>
        </defs>
        <rect width="640" height="220" fill="url(#walletEmptySky)" />
        <circle cx="520" cy="58" r="28" fill="#fff7e0" opacity="0.9" />
        <path
          d="M0 148 C90 128 150 158 240 142 C330 126 390 112 470 128 C540 140 590 136 640 124 L640 220 L0 220 Z"
          fill="url(#walletEmptySea)"
        />
        <path
          d="M48 168 C88 148 118 152 148 168 C118 172 88 176 48 168 Z"
          fill="#0a2540"
          opacity="0.12"
        />
        <rect x="268" y="118" width="104" height="58" rx="14" fill="#fff" opacity="0.92" />
        <rect x="280" y="132" width="48" height="8" rx="4" fill="#0071e3" opacity="0.85" />
        <rect x="280" y="146" width="72" height="6" rx="3" fill="#0a2540" opacity="0.18" />
        <rect x="280" y="158" width="36" height="6" rx="3" fill="#0a2540" opacity="0.12" />
        <circle cx="348" cy="156" r="14" fill="#0071e3" opacity="0.9" />
        <path
          d="M342 156 h12 M348 150 v12"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
      <span className="wallet-pass-empty-art-brand">{brandLabel}</span>
    </div>
  );
}

function coverForBooking(booking, fallbackCover, tripImageFn) {
  if (typeof tripImageFn === 'function') {
    const url = tripImageFn(booking);
    if (url) return url;
  }
  return fallbackCover || '';
}

export default function WalletBoardingPass({
  booking,
  bookings,
  coverImage,
  brandLabel = 'My Wallet',
  passengerName = '',
  onOpenDetails,
  onBrowseTrips,
  onOpenTrip,
  onQrChange,
  offline = false,
  layout = 'phone',
  featuredTrips = [],
  tripImageFor,
}) {
  const isDesktop = layout === 'desktop';
  const ticketList = useMemo(() => {
    const sources =
      Array.isArray(bookings) && bookings.length > 0
        ? bookings
        : booking
          ? [booking]
          : [];
    return expandWalletTickets(sources, { passengerName });
  }, [bookings, booking, passengerName]);

  const ticketSignature = ticketList.map((t) => t.key).join('|');
  const [activeKey, setActiveKey] = useState(() => ticketList[0]?.key || '');
  // Reset selection when the ticket set changes (new claim / hydrate).
  const [prevSignature, setPrevSignature] = useState(ticketSignature);
  if (prevSignature !== ticketSignature) {
    setPrevSignature(ticketSignature);
    setActiveKey(ticketList[0]?.key || '');
  }
  const activeIndex = Math.max(
    0,
    ticketList.findIndex((t) => t.key === activeKey),
  );
  const setActiveIndex = (index) => {
    const next = ticketList[index];
    if (next) setActiveKey(next.key);
  };

  if (!ticketList.length) {
    const trips = Array.isArray(featuredTrips) ? featuredTrips.slice(0, 3) : [];
    return (
      <section
        className={`wallet-pass-empty${isDesktop ? ' wallet-pass-empty--desktop' : ''}`}
      >
        {isDesktop ? <WalletEmptyHorizon brandLabel={brandLabel} /> : null}
        <div className="wallet-pass-empty-inner">
          {!isDesktop ? (
            <span className="material-symbols-outlined wallet-pass-empty-icon" aria-hidden>
              confirmation_number
            </span>
          ) : (
            <p className="wallet-pass-empty-kicker">{brandLabel}</p>
          )}
          <h2 className="wallet-pass-empty-title">
            {isDesktop ? 'Το εισιτήριό σας, πάντα μαζί σας' : 'Δεν έχετε ακόμα εισιτήριο'}
          </h2>
          <p className="wallet-pass-empty-copy">
            {isDesktop
              ? 'Κράτηση στο site → QR επιβίβασης εδώ. Ένα σημείο για κάθε διαδρομή.'
              : onBrowseTrips
                ? 'Κάντε κράτηση στο site — μετά την πληρωμή δημιουργείτε My Wallet και εμφανίζεται εδώ το QR επιβίβασης.'
                : 'Μετά την πληρωμή κράτησης, συνδεθείτε εδώ για να εμφανιστεί το QR επιβίβασης.'}
          </p>
          <div className="wallet-pass-empty-actions">
            {onBrowseTrips ? (
              <button type="button" className="wallet-pass-cta" onClick={onBrowseTrips}>
                Δείτε εκδρομές
                <span className="material-symbols-outlined" aria-hidden>
                  arrow_forward
                </span>
              </button>
            ) : null}
            <Link to="/my-booking" className="wallet-pass-empty-secondary">
              Έχω ήδη κωδικό κράτησης
            </Link>
          </div>
          {isDesktop && trips.length > 0 ? (
            <div className="wallet-pass-empty-trips" aria-label="Εκδρομές γραφείου">
              {trips.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="wallet-pass-empty-trip"
                  onClick={() => (onOpenTrip ? onOpenTrip(t) : onBrowseTrips?.())}
                >
                  <span className="wallet-pass-empty-trip-title truncate">{t.title}</span>
                  {t.price != null && t.price !== '' ? (
                    <span className="wallet-pass-empty-trip-meta">
                      από €{Number(t.price).toFixed(0)}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  const multi = ticketList.length > 1;
  const front = ticketList[Math.min(activeIndex, ticketList.length - 1)] || ticketList[0];

  // Multi-ticket: classic Apple Wallet vertical stack (phone + desktop)
  if (multi) {
    return (
      <section className="wallet-pass wallet-pass--vstack" aria-label="Εισιτήρια επιβίβασης">
        <p className="wallet-pass-vstack-hint" role="status">
          {ticketList.length} εισιτήρια · πατήστε μία κεφαλίδα για να έρθει μπροστά
        </p>
        <div className="wallet-pass-vstack" style={{ '--wallet-stack-count': ticketList.length }}>
          {ticketList.map((ticket, index) => {
            const paid = isPaid(ticket.booking);
            const st = statusStyle(ticket.booking);
            const pnr = ticket.booking.pnr || ticket.booking.id;
            const isFront = index === activeIndex;
            const mark = isFront ? bookingFiscalMark(ticket.booking) : null;
            const cover = coverForBooking(ticket.booking, coverImage, tripImageFor);
            // Peeks above the front stay under it; peeks below sit on top of the front bottom edge.
            const z = isFront
              ? ticketList.length + 2
              : index < activeIndex
                ? index + 1
                : ticketList.length - index + ticketList.length;
            return (
              <div
                key={ticket.key}
                className={`wallet-pass-vstack-slot${isFront ? ' is-front' : ' is-peek'}`}
                style={{ zIndex: z }}
              >
                <PassengerTicketCard
                  booking={ticket.booking}
                  passenger={ticket.passenger}
                  coverImage={cover}
                  brandLabel={brandLabel}
                  paid={paid}
                  status={st}
                  pnr={pnr}
                  mark={mark}
                  offline={offline}
                  onOpenDetails={onOpenDetails}
                  onQrChange={isFront ? onQrChange : undefined}
                  showActions={isFront}
                  showQr={isFront}
                  compactHeader
                  isFront={isFront}
                  onSelect={() => setActiveIndex(index)}
                  stackIndex={index}
                  stackTotal={ticketList.length}
                />
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  // Single ticket — preserve classic hero + one card layout
  const single = front;
  const paid = isPaid(single.booking);
  const st = statusStyle(single.booking);
  const pnr = single.booking.pnr || single.booking.id;
  const mark = bookingFiscalMark(single.booking);
  const cover = coverForBooking(single.booking, coverImage, tripImageFor);

  return (
    <section className="wallet-pass" aria-label="Εισιτήρια επιβίβασης">
      <div
        className="wallet-pass-hero"
        style={{ backgroundImage: cover ? `url(${cover})` : undefined }}
      >
        <div className="wallet-pass-hero-shade" aria-hidden />
        <div className="wallet-pass-hero-copy">
          <p className="wallet-pass-brand">{brandLabel}</p>
          <h1 className="wallet-pass-title">{single.booking.tripTitle || 'Εκδρομή'}</h1>
          <p className="wallet-pass-when">{formatTripWhen(single.booking)}</p>
        </div>
      </div>

      <div className="wallet-pass-stack">
        <PassengerTicketCard
          booking={single.booking}
          passenger={single.passenger}
          coverImage={cover}
          brandLabel={brandLabel}
          paid={paid}
          status={st}
          pnr={pnr}
          mark={mark}
          offline={offline}
          onOpenDetails={onOpenDetails}
          onQrChange={onQrChange}
          showActions
          stackIndex={0}
          stackTotal={1}
        />
      </div>
    </section>
  );
}
