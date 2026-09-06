/**
 * Printable boarding pass — matches My Wallet pass look.
 * Browser Print → Save as PDF.
 */
import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { formatMoney } from '../lib/currency/multiCurrency.js';
import { fetchSiteAppearance } from '../services/siteAppearanceApi.js';
import { resolveOfficeBrand } from '../lib/branding/officeBrand.js';
import '../styles/wallet-pass.css';
import '../styles/ticket-print.css';

function Field({ label, children }) {
  return (
    <div className="ticket-print-field">
      <div className="ticket-print-kicker">{label}</div>
      <div className="ticket-print-value">{children}</div>
    </div>
  );
}

function TicketQr({ value }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(value)}&margin=10`;
  return (
    <img
      src={src}
      width={200}
      height={200}
      alt="QR εισιτηρίου"
      className="ticket-print-qr-img"
    />
  );
}

function TicketPassCard({ booking, tripTitle, brandLabel, coverImage }) {
  const pnr = booking.pnr || booking.ticketRef || booking.id;
  const passenger =
    booking.customerName || booking.passengerName || booking.name || '—';
  const dateStr = booking.date
    ? new Date(`${booking.date}T12:00:00`).toLocaleDateString('el-GR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—';
  const qrValue = booking._printQr || String(pnr);

  return (
    <article className="ticket-print-pass" aria-label="Εισιτήριο για εκτύπωση">
      <div
        className="ticket-print-hero"
        style={coverImage ? { backgroundImage: `url(${coverImage})` } : undefined}
      >
        <div className="ticket-print-hero-shade" aria-hidden />
        <div className="ticket-print-hero-copy">
          <p className="ticket-print-brand">{brandLabel}</p>
          <h1 className="ticket-print-title">{tripTitle}</h1>
          <p className="ticket-print-when">
            {dateStr}
            {booking.time ? ` · ${booking.time}` : ''}
          </p>
        </div>
      </div>

      <div className="ticket-print-body">
        <div className="ticket-print-grid">
          <Field label="Επιβάτης">
            <strong>{passenger}</strong>
          </Field>
          <Field label="Θέση">
            <strong className="ticket-print-seat">{booking.seat || '—'}</strong>
          </Field>
          <Field label="Κωδικός">
            <span className="ticket-print-mono">{pnr}</span>
          </Field>
          <Field label="Ποσό">
            <strong>
              {booking.price != null
                ? formatMoney(booking.price, booking.currency || 'EUR')
                : '—'}
            </strong>
          </Field>
        </div>

        {Array.isArray(booking.extras) && booking.extras.length > 0 ? (
          <p className="ticket-print-hint" style={{ marginTop: '0.75rem', textAlign: 'left' }}>
            Υπηρεσίες:{' '}
            {booking.extras
              .map((line) => `${line.title}${line.qty > 1 ? ` ×${line.qty}` : ''}`)
              .join(' · ')}
          </p>
        ) : null}

        <div className="ticket-print-perforation" aria-hidden />

        <div className="ticket-print-qr-block">
          <div className="ticket-print-qr-frame">
            <TicketQr value={qrValue} />
          </div>
          <p className="ticket-print-mono ticket-print-pnr-lg">{pnr}</p>
          <p className="ticket-print-hint">Δείξτε το QR στον οδηγό κατά την επιβίβαση</p>
        </div>

        <p className="ticket-print-footer">
          Κράτηση #{booking.id}
          {booking.email ? ` · ${booking.email}` : ''}
          {booking.phone ? ` · ${booking.phone}` : ''}
        </p>
      </div>
    </article>
  );
}

export default function TicketPrintPage() {
  const { bookingId: rawId } = useParams();
  const [searchParams] = useSearchParams();
  const bookingId = decodeURIComponent(rawId || '').trim();
  const autoPrint = searchParams.get('print') === '1';
  const [resolved, setResolved] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [brandLabel, setBrandLabel] = useState('My Wallet');

  useEffect(() => {
    let cancelled = false;
    fetchSiteAppearance()
      .then((data) => {
        if (cancelled) return;
        const brand = resolveOfficeBrand(data || {});
        const name = brand.displayName || brand.name;
        if (name) setBrandLabel(name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!bookingId || bookingId === 'demo') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const mod = await import('../lib/ticketing/bookingStore.js');
        const { getTripById, loadTrips } = await import('../lib/trips/tripStore.js');
        const { mockBookings } = await import('../data/mockData.js');
        const { issueSignedQrToken } = await import('../lib/ticketing/qrToken.js');

        const booking =
          mod.getBookingById(bookingId) || mockBookings.find((b) => b.id === bookingId);
        if (!booking) {
          if (!cancelled) setLoadError('notfound');
          return;
        }
        loadTrips();
        const trip = getTripById(booking.tripId);
        let printQr = booking.pnr || booking.id;
        if (mod.isBookingPaid(booking)) {
          try {
            printQr = await issueSignedQrToken(booking);
          } catch {
            /* keep PNR */
          }
        }
        if (!cancelled) {
          setResolved({
            booking: { ...booking, _printQr: printQr },
            tripTitle: trip?.title || booking.tripTitle || 'Εκδρομή',
            coverImage: trip?.image || '/images/hero-bus-achillio.png',
          });
        }
      } catch (err) {
        console.error('[TicketPrintPage]', err);
        if (!cancelled) setLoadError('crash');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  useEffect(() => {
    if (!autoPrint || !resolved) return undefined;
    const t = window.setTimeout(() => window.print(), 450);
    return () => window.clearTimeout(t);
  }, [autoPrint, resolved]);

  if (!bookingId || bookingId === 'demo') {
    return <Navigate to="/my-booking" replace />;
  }

  if (!resolved && !loadError) {
    return (
      <div className="wallet-app ticket-print-shell">
        <p className="ticket-print-status">Φόρτωση εισιτηρίου…</p>
      </div>
    );
  }

  if (loadError === 'notfound') {
    return (
      <div className="wallet-app ticket-print-shell">
        <div className="ticket-print-status">
          <p className="font-bold text-rose-700">Η κράτηση «{bookingId}» δεν βρέθηκε.</p>
          <Link to="/my-booking" className="ticket-print-link">
            Ανάκτηση κράτησης
          </Link>
        </div>
      </div>
    );
  }

  if (loadError === 'crash' || !resolved) {
    return (
      <div className="wallet-app ticket-print-shell">
        <div className="ticket-print-status">
          <p className="font-bold text-rose-700">Σφάλμα φόρτωσης.</p>
          <Link to="/my-booking" className="ticket-print-link">
            Ανάκτηση κράτησης
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-app ticket-print-shell">
      <div className="ticket-print-toolbar no-print-ticket">
        <div>
          <h1 className="ticket-print-toolbar-title">Εισιτήριο</h1>
          <p className="ticket-print-toolbar-copy">Εκτύπωση ή Αποθήκευση ως PDF</p>
        </div>
        <div className="ticket-print-toolbar-actions">
          <button type="button" className="wallet-pass-cta" onClick={() => window.print()}>
            <span className="material-symbols-outlined" aria-hidden>
              print
            </span>
            Εκτύπωση / PDF
          </button>
          <Link to="/wallet" className="wallet-pass-secondary wallet-ticket-email">
            Πίσω στο My Wallet
          </Link>
        </div>
      </div>

      <TicketPassCard
        booking={resolved.booking}
        tripTitle={resolved.tripTitle}
        brandLabel={brandLabel}
        coverImage={resolved.coverImage}
      />
    </div>
  );
}
