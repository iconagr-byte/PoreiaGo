/**
 * Printable boarding pass (browser window → Print / Save as PDF).
 */
import { issueSignedQrToken } from './qrToken.js';
import { isBookingPaid } from './bookingStore.js';
import { formatMoney } from '../currency/multiCurrency.js';

const PRINT_STASH_KEY = 'poreiago_ticket_print_stash_v1';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function qrImageUrl(data, size = 200) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&margin=8`;
}

/** Same-tab print page (no popup). Pass `{ autoPrint: true }` to open print dialog. */
export function ticketPrintPath(bookingId, { autoPrint = false } = {}) {
  const id = bookingId || 'demo';
  const base = `/ticket/print/${encodeURIComponent(id)}`;
  return autoPrint ? `${base}?print=1` : base;
}

/** iOS/Android installed PWA — `window.print()` is often a silent no-op. */
export function isStandaloneApp() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia?.('(display-mode: standalone)')?.matches) return true;
    if (window.matchMedia?.('(display-mode: fullscreen)')?.matches) return true;
    if (window.navigator?.standalone === true) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function canUseWindowPrint() {
  return typeof window !== 'undefined' && typeof window.print === 'function' && !isStandaloneApp();
}

/**
 * Stash booking payload so `/ticket/print/:id` can render even when localStorage
 * lookup fails (API-only / race / different id key).
 * @param {{ booking: object, tripTitle?: string, coverImage?: string, brandLabel?: string, printQr?: string }} payload
 */
export function stashTicketForPrint(payload) {
  if (typeof window === 'undefined' || !payload?.booking?.id) return;
  try {
    sessionStorage.setItem(
      PRINT_STASH_KEY,
      JSON.stringify({
        ...payload,
        stashedAt: Date.now(),
      }),
    );
  } catch {
    /* private mode / quota */
  }
}

/** @param {string} [bookingId] */
export function consumeTicketPrintStash(bookingId) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PRINT_STASH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.booking?.id) return null;
    if (bookingId && String(parsed.booking.id) !== String(bookingId)) {
      // Also accept saasBookingId match
      if (String(parsed.booking.saasBookingId || '') !== String(bookingId)) return null;
    }
    sessionStorage.removeItem(PRINT_STASH_KEY);
    return parsed;
  } catch {
    return null;
  }
}

export function triggerBrowserPrint() {
  if (!canUseWindowPrint()) return false;
  try {
    window.print();
    return true;
  } catch {
    return false;
  }
}

/**
 * Download a self-contained HTML ticket (open → Share/Print → PDF on phones).
 * @param {string} html
 * @param {string} [filename]
 */
export function downloadTicketHtml(html, filename = 'eisitirio.html') {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function buildTicketPrintHtml({
  booking,
  tripTitle,
  company,
  qrToken,
  autoPrint = true,
}) {
  const passenger =
    booking.customerName || booking.passengerName || booking.name || '—';
  const seat = booking.seat || (Array.isArray(booking.seats) ? booking.seats.join(', ') : booking.seats) || '—';
  const pnr = booking.pnr || booking.ticketRef || booking.id;
  const dateStr = booking.date
    ? new Date(booking.date).toLocaleDateString('el-GR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—';
  const timeStr = booking.time || '—';
  const price =
    booking.price != null ? formatMoney(booking.price, booking.currency || 'EUR') : '—';
  const invoice = booking.invoiceNumber || '—';
  const qrSrc = qrImageUrl(qrToken, 220);

  return `<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Εισιτήριο ${escapeHtml(pnr)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      margin: 0;
      padding: 24px;
      background: #f0f2f5;
      color: #111;
    }
    .ticket {
      max-width: 420px;
      margin: 0 auto;
      background: #fff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12);
      border: 1px solid #e5e7eb;
    }
    .header {
      background: linear-gradient(135deg, #0040df 0%, #002a96 100%);
      color: #fff;
      padding: 20px 24px 18px;
    }
    .header .brand {
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      opacity: 0.85;
      margin-bottom: 6px;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      line-height: 1.25;
    }
    .header .sub {
      margin-top: 8px;
      font-size: 13px;
      opacity: 0.9;
    }
    .perforation {
      position: relative;
      height: 20px;
      background: #fff;
    }
    .perforation::before {
      content: "";
      position: absolute;
      left: 16px;
      right: 16px;
      top: 50%;
      border-top: 2px dashed #d1d5db;
    }
    .perforation .notch-l,
    .perforation .notch-r {
      position: absolute;
      top: 50%;
      width: 16px;
      height: 16px;
      background: #f0f2f5;
      border-radius: 50%;
      transform: translateY(-50%);
    }
    .notch-l { left: -8px; border-right: 1px solid #e5e7eb; }
    .notch-r { right: -8px; border-left: 1px solid #e5e7eb; }
    .body { padding: 20px 24px 24px; }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px 12px;
      margin-bottom: 20px;
    }
    .field label {
      display: block;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #6b7280;
      margin-bottom: 3px;
    }
    .field span {
      font-size: 15px;
      font-weight: 700;
      color: #111827;
    }
    .field.seat span {
      font-size: 22px;
      color: #0040df;
    }
    .qr-block {
      text-align: center;
      border-top: 1px solid #f3f4f6;
      padding-top: 18px;
    }
    .qr-block img {
      width: 200px;
      height: 200px;
      border: 2px dashed #e5e7eb;
      border-radius: 12px;
      padding: 8px;
      background: #fafafa;
    }
    .pnr {
      margin-top: 12px;
      font-family: ui-monospace, monospace;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 0.15em;
    }
    .hint {
      margin-top: 8px;
      font-size: 10px;
      color: #9ca3af;
    }
    .footer {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #f3f4f6;
      font-size: 10px;
      color: #6b7280;
      line-height: 1.5;
    }
    .footer strong { color: #374151; }
    .toolbar {
      max-width: 420px;
      margin: 0 auto 16px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
    }
    .toolbar button {
      border: 0;
      border-radius: 999px;
      padding: 10px 16px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      background: #0f172a;
      color: #fff;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .ticket { box-shadow: none; border: none; max-width: 100%; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button type="button" onclick="window.print()">Εκτύπωση / PDF</button>
  </div>
  <p class="no-print" style="text-align:center;color:#666;font-size:13px;margin-bottom:16px;">
    Προεπισκόπηση εισιτηρίου — «Εκτύπωση / PDF» ή Αποθήκευση ως PDF
  </p>
  <div class="ticket">
    <div class="header">
      <div class="brand">${escapeHtml(company)}</div>
      <h1>${escapeHtml(tripTitle)}</h1>
      <div class="sub">${escapeHtml(dateStr)} · Αναχώρηση ${escapeHtml(timeStr)}</div>
    </div>
    <div class="perforation">
      <div class="notch-l"></div>
      <div class="notch-r"></div>
    </div>
    <div class="body">
      <div class="grid">
        <div class="field">
          <label>Επιβάτης</label>
          <span>${escapeHtml(passenger)}</span>
        </div>
        <div class="field seat">
          <label>Θέση</label>
          <span>${escapeHtml(seat)}</span>
        </div>
        <div class="field">
          <label>Κωδ. κράτησης (PNR)</label>
          <span style="font-family:monospace;font-size:13px;">${escapeHtml(pnr)}</span>
        </div>
        <div class="field">
          <label>Τιμή</label>
          <span>${escapeHtml(price)}</span>
        </div>
        <div class="field">
          <label>Τηλέφωνο</label>
          <span style="font-size:13px;">${escapeHtml(booking.phone || '—')}</span>
        </div>
        <div class="field">
          <label>Τιμολόγιο</label>
          <span style="font-size:12px;">${escapeHtml(invoice)}</span>
        </div>
      </div>
      <div class="qr-block">
        <img src="${qrSrc}" alt="QR εισιτηρίου" width="200" height="200" />
        <div class="pnr">${escapeHtml(pnr)}</div>
        <p class="hint">Σκανάρετε κατά την επιβίβαση · ισχύει για αυτή την εκδρομή</p>
      </div>
      <div class="footer">
        <strong>Σημαντικό:</strong> Φέρετε ταυτότητα ή διαβατήριο. Άφιξη στο σημείο αναχώρησης
        τουλάχιστον 15 λεπτά πριν. Κράτηση #${escapeHtml(booking.id)}.
        ${booking.email ? `<br />Email: ${escapeHtml(booking.email)}` : ''}
      </div>
    </div>
  </div>
  <script>
    ${autoPrint ? 'window.onload = () => setTimeout(() => { try { window.print(); } catch (e) {} }, 400);' : ''}
  </script>
</body>
</html>`;
}

/**
 * @param {object} booking
 * @param {object} [trip]
 * @param {{ autoPrint?: boolean, companyName?: string, qrToken?: string, allowUnpaid?: boolean }} [opts]
 */
export async function openTicketPrintWindow(booking, trip, opts = {}) {
  if (!booking) {
    throw new Error('Δεν υπάρχει κράτηση για εκτύπωση');
  }
  if (!opts.allowUnpaid && !isBookingPaid(booking)) {
    throw new Error('Η κράτηση δεν είναι εξοφλημένη');
  }

  // Open *before* any await so the browser keeps the user-gesture (popup blockers).
  const win = window.open('', '_blank', 'width=480,height=820');
  if (!win) {
    const err = new Error('Ο browser μπλόκαρε το popup — επιτρέψτε popups για εκτύπωση');
    err.code = 'POPUP_BLOCKED';
    throw err;
  }
  try {
    win.document.write(
      '<!DOCTYPE html><html lang="el"><head><meta charset="utf-8" /><title>Εισιτήριο</title></head><body style="font-family:system-ui,sans-serif;padding:24px;color:#64748b;">Φόρτωση εισιτηρίου…</body></html>',
    );
    win.document.close();
  } catch {
    /* ignore */
  }

  let qrToken = opts.qrToken || '';
  if (!qrToken) {
    try {
      qrToken = await issueSignedQrToken(booking);
    } catch {
      qrToken = booking.pnr || booking.id || 'INVALID';
    }
  }

  const company = opts.companyName || 'PoreiaGo Travel';
  const tripTitle = trip?.title || booking.tripTitle || 'Εκδρομή';
  const html = buildTicketPrintHtml({
    booking,
    tripTitle,
    company,
    qrToken,
    autoPrint: opts.autoPrint !== false,
  });

  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
    try {
      win.focus();
    } catch {
      /* ignore */
    }
  } catch {
    try {
      win.close();
    } catch {
      /* ignore */
    }
    const err = new Error('Αποτυχία ανοίγματος παραθύρου εκτύπωσης');
    err.code = 'PRINT_WINDOW_FAILED';
    throw err;
  }
}

/**
 * Wallet / detail CTA: open printable ticket (popup → same-tab → HTML download).
 * @param {{
 *   booking: object,
 *   trip?: object,
 *   tripTitle?: string,
 *   coverImage?: string,
 *   brandLabel?: string,
 *   navigate?: (path: string) => void,
 * }} args
 * @returns {Promise<'popup'|'navigate'|'download'>}
 */
export async function startWalletTicketPrint({
  booking,
  trip,
  tripTitle,
  coverImage,
  brandLabel = 'My Wallet',
  navigate,
}) {
  if (!booking?.id) {
    throw new Error('Δεν υπάρχει κράτηση για εκτύπωση');
  }

  const title = tripTitle || trip?.title || booking.tripTitle || 'Εκδρομή';
  stashTicketForPrint({
    booking,
    tripTitle: title,
    coverImage: coverImage || trip?.image || '',
    brandLabel,
  });

  // Installed PWA: print dialog usually does nothing — download HTML instead.
  if (isStandaloneApp()) {
    let qrToken = booking.pnr || booking.id;
    try {
      if (isBookingPaid(booking)) qrToken = await issueSignedQrToken(booking);
    } catch {
      /* keep PNR */
    }
    const html = buildTicketPrintHtml({
      booking,
      tripTitle: title,
      company: brandLabel,
      qrToken,
      autoPrint: false,
    });
    const pnr = booking.pnr || booking.ticketRef || booking.id;
    downloadTicketHtml(html, `eisitirio-${pnr}.html`);
    return 'download';
  }

  try {
    await openTicketPrintWindow(booking, trip || { title }, {
      companyName: brandLabel,
      allowUnpaid: true,
      autoPrint: true,
    });
    return 'popup';
  } catch (err) {
    if (typeof navigate === 'function') {
      navigate(ticketPrintPath(booking.id, { autoPrint: true }));
      return 'navigate';
    }
    throw err;
  }
}

/** Demo ticket (mock booking B-1029) for preview without login. */
export async function openDemoTicketPrint() {
  const { mockBookings } = await import('../../data/mockData.js');
  const { loadTrips } = await import('../trips/tripStore.js');
  const booking = mockBookings[0];
  const trip = loadTrips().find((t) => t.id === booking.tripId) || null;
  return openTicketPrintWindow(booking, trip);
}
