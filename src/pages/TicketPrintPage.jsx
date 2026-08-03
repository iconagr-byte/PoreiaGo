/**
 * Printable boarding pass — matches My Wallet pass look.
 * Browser Print → Save as PDF.
 */
import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatMoney } from '../lib/currency/multiCurrency.js';
import { fetchSiteAppearance } from '../services/siteAppearanceApi.js';
import { resolveOfficeBrand } from '../lib/branding/officeBrand.js';
import {
  canUseWindowPrint,
  consumeTicketPrintStash,
  downloadTicketHtml,
  isStandaloneApp,
  stashTicketForPrint,
  triggerBrowserPrint,
} from '../lib/ticketing/printTicket.js';
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

function passOuterHtml({ booking, tripTitle, brandLabel }) {
  const pnr = booking.pnr || booking.ticketRef || booking.id;
  const passenger =
    booking.customerName || booking.passengerName || booking.name || '—';
  const seat = booking.seat || '—';
  const dateStr = booking.date
    ? new Date(`${booking.date}T12:00:00`).toLocaleDateString('el-GR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—';
  const qrValue = booking._printQr || String(pnr);
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrValue)}&margin=10`;
  const price =
    booking.price != null ? formatMoney(booking.price, booking.currency || 'EUR') : '—';
  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html lang="el"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Εισιτήριο ${esc(pnr)}</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;padding:20px;background:#f1f5f9;color:#0f172a}
.card{max-width:26rem;margin:0 auto;background:#fff;border-radius:1.2rem;overflow:hidden;border:1px solid #e2e8f0}
.hero{background:linear-gradient(145deg,#1e3a5f,#0f4c81);color:#fff;padding:1.25rem 1.1rem}
.brand{font-size:.7rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.85}
h1{margin:.35rem 0 0;font-size:1.25rem}
.when{margin:.4rem 0 0;font-size:.85rem;opacity:.9}
.body{padding:1rem 1.1rem 1.25rem}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:.85rem}
.k{font-size:.65rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8}
.v{font-weight:700;margin-top:.15rem}
.qr{text-align:center;margin-top:1rem;padding-top:1rem;border-top:1px dashed #e2e8f0}
.toolbar{display:flex;justify-content:center;gap:.5rem;margin-bottom:1rem}
button{border:0;border-radius:999px;padding:.7rem 1.1rem;background:#0f172a;color:#fff;font-weight:700}
@media print{.toolbar{display:none}body{background:#fff;padding:0}.card{border:0}}
</style></head><body>
<div class="toolbar"><button type="button" onclick="window.print()">Εκτύπωση / PDF</button></div>
<div class="card">
  <div class="hero"><div class="brand">${esc(brandLabel)}</div><h1>${esc(tripTitle)}</h1>
  <p class="when">${esc(dateStr)}${booking.time ? ` · ${esc(booking.time)}` : ''}</p></div>
  <div class="body">
    <div class="grid">
      <div><div class="k">Επιβάτης</div><div class="v">${esc(passenger)}</div></div>
      <div><div class="k">Θέση</div><div class="v">${esc(seat)}</div></div>
      <div><div class="k">Κωδικός</div><div class="v">${esc(pnr)}</div></div>
      <div><div class="k">Ποσό</div><div class="v">${esc(price)}</div></div>
    </div>
    <div class="qr"><img src="${qrSrc}" width="200" height="200" alt="QR" /><p class="v" style="letter-spacing:.12em;margin:.6rem 0 0">${esc(pnr)}</p></div>
  </div>
</div>
</body></html>`;
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
        const stash = consumeTicketPrintStash(bookingId);
        const mod = await import('../lib/ticketing/bookingStore.js');
        const { getTripById, loadTrips } = await import('../lib/trips/tripStore.js');
        const { mockBookings } = await import('../data/mockData.js');
        const { issueSignedQrToken } = await import('../lib/ticketing/qrToken.js');
        const { loadLastPass } = await import('../lib/wallet/lastPassSnapshot.js');

        let booking =
          stash?.booking ||
          mod.getBookingById(bookingId) ||
          mockBookings.find((b) => b.id === bookingId) ||
          null;

        if (!booking) {
          const last = loadLastPass();
          if (last?.booking?.id && String(last.booking.id) === String(bookingId)) {
            booking = last.booking;
          }
        }

        if (!booking) {
          if (!cancelled) setLoadError('notfound');
          return;
        }

        loadTrips();
        const trip = getTripById(booking.tripId);
        let printQr = stash?.printQr || booking.pnr || booking.id;
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
            tripTitle: stash?.tripTitle || trip?.title || booking.tripTitle || 'Εκδρομή',
            coverImage:
              stash?.coverImage || trip?.image || '/images/hero-bus-achillio.png',
            brandLabel: stash?.brandLabel || '',
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
    if (!canUseWindowPrint()) {
      toast('Στο app πατήστε «Λήψη HTML» και μετά Εκτύπωση / PDF.', { icon: '📄', duration: 4500 });
      return undefined;
    }
    const t = window.setTimeout(() => {
      triggerBrowserPrint();
    }, 450);
    return () => window.clearTimeout(t);
  }, [autoPrint, resolved]);

  const handlePrint = () => {
    if (triggerBrowserPrint()) return;
    // Standalone / blocked — download self-contained ticket
    if (!resolved) return;
    const html = passOuterHtml({
      booking: resolved.booking,
      tripTitle: resolved.tripTitle,
      brandLabel: resolved.brandLabel || brandLabel,
    });
    const pnr = resolved.booking.pnr || resolved.booking.ticketRef || resolved.booking.id;
    downloadTicketHtml(html, `eisitirio-${pnr}.html`);
    toast.success('Κατέβηκε το εισιτήριο — άνοιξέ το και επίλεξε Εκτύπωση / PDF');
  };

  const handleDownload = () => {
    if (!resolved) return;
    stashTicketForPrint({
      booking: resolved.booking,
      tripTitle: resolved.tripTitle,
      coverImage: resolved.coverImage,
      brandLabel: resolved.brandLabel || brandLabel,
      printQr: resolved.booking._printQr,
    });
    const html = passOuterHtml({
      booking: resolved.booking,
      tripTitle: resolved.tripTitle,
      brandLabel: resolved.brandLabel || brandLabel,
    });
    const pnr = resolved.booking.pnr || resolved.booking.ticketRef || resolved.booking.id;
    downloadTicketHtml(html, `eisitirio-${pnr}.html`);
    toast.success('Αρχείο έτοιμο για άνοιγμα / PDF');
  };

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

  const label = resolved.brandLabel || brandLabel;

  return (
    <div className="wallet-app ticket-print-shell">
      <div className="ticket-print-toolbar no-print-ticket">
        <div>
          <h1 className="ticket-print-toolbar-title">Εισιτήριο</h1>
          <p className="ticket-print-toolbar-copy">
            {isStandaloneApp()
              ? 'Στο εγκατεστημένο app: Λήψη HTML → άνοιγμα → Εκτύπωση / PDF'
              : 'Εκτύπωση ή Αποθήκευση ως PDF'}
          </p>
        </div>
        <div className="ticket-print-toolbar-actions">
          <button type="button" className="wallet-pass-cta" onClick={handlePrint}>
            <span className="material-symbols-outlined" aria-hidden>
              print
            </span>
            Εκτύπωση / PDF
          </button>
          <button type="button" className="wallet-pass-secondary wallet-ticket-email" onClick={handleDownload}>
            <span className="material-symbols-outlined" aria-hidden>
              download
            </span>
            Λήψη HTML
          </button>
          <Link to="/wallet" className="wallet-pass-secondary wallet-ticket-email">
            Πίσω στο My Wallet
          </Link>
        </div>
      </div>

      <TicketPassCard
        booking={resolved.booking}
        tripTitle={resolved.tripTitle}
        brandLabel={label}
        coverImage={resolved.coverImage}
      />
    </div>
  );
}
