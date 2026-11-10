/**
 * Printable / exportable passenger manifest (bus + airline group details).
 */
import { formatMoney } from '../currency/multiCurrency.js';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function exportTripManifestPdf({
  tripTitle,
  date,
  bookings,
  companyName = 'PoreiaGo Travel',
  flights = [],
  currency = 'EUR',
}) {
  const flightBlock =
    (flights || []).length > 0
      ? `
    <h2>Group flights / PNR</h2>
    <table>
      <thead>
        <tr>
          <th>Πτήση</th>
          <th>Διαδρομή</th>
          <th>PNR</th>
          <th>Θέσεις</th>
          <th>Κόστος</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${(flights || [])
          .map(
            (f) => `
          <tr>
            <td>${escapeHtml((f.airline ? f.airline + ' ' : '') + (f.flight_number || ''))}</td>
            <td>${escapeHtml(f.departure_airport || '')} → ${escapeHtml(f.arrival_airport || '')}</td>
            <td>${escapeHtml(f.pnr_code || '—')}</td>
            <td>${escapeHtml(f.seats_allocated ?? '—')}</td>
            <td>${escapeHtml(formatMoney(f.total_cost || 0, f.currency || currency))}</td>
            <td>${escapeHtml(f.status || 'scheduled')}${f.delay_minutes ? ` (+${f.delay_minutes}′)` : ''}</td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>`
      : '';

  const rows = (bookings || [])
    .map(
      (b, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(b.date || '—')}</td>
      <td>${escapeHtml(b.customerName || b.user || '—')}</td>
      <td>${escapeHtml(b.seat || (b.seats || []).join(', ') || '—')}</td>
      <td>${escapeHtml(b.flightSeat || '—')}</td>
      <td>${escapeHtml(b.pnr || b.ticketCode || b.id || '—')}</td>
      <td>${escapeHtml(formatMoney(b.price || 0, b.currency || currency))}</td>
      <td>${b.checkedIn || b.checkInStatus === 'BOARDED' ? '✓' : '—'}</td>
    </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="utf-8" />
  <title>Manifest — ${escapeHtml(tripTitle)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; color: #111; }
    h1 { font-size: 1.25rem; margin: 0 0 4px; }
    h2 { font-size: 0.95rem; margin: 20px 0 8px; }
    .meta { color: #555; font-size: 0.85rem; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-bottom: 12px; }
    th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; }
    th { background: #f3f4f6; font-weight: 700; text-transform: uppercase; font-size: 0.7rem; }
    tr:nth-child(even) { background: #fafafa; }
    .foot { margin-top: 24px; font-size: 0.75rem; color: #666; }
    @media print { body { margin: 12px; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(companyName)} — Επιβατικό Manifest</h1>
  <p class="meta">
    <strong>${escapeHtml(tripTitle)}</strong><br/>
    Αναχώρηση: ${escapeHtml(date)} · Επιβάτες: ${bookings?.length ?? 0}<br/>
    Εκτύπωση: ${new Date().toLocaleString('el-GR')}
  </p>
  ${flightBlock}
  <h2>Επιβάτες (λεωφορείο + αεροπορικό)</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Αναχώρηση</th>
        <th>Επιβάτης</th>
        <th>Θέση λεωφ.</th>
        <th>Θέση πτήσης</th>
        <th>PNR / Ticket</th>
        <th>Τιμή</th>
        <th>Check-in</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="8">Δεν υπάρχουν κρατήσεις</td></tr>'}</tbody>
  </table>
  <p class="foot">Εμπιστευτικό — εσωτερική χρήση διαχείρισης στόλου & tour leaders.</p>
</body>
</html>`;

  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) {
    throw new Error('Ο browser μπλόκαρε το popup — επιτρέψτε αναδυόμενα παράθυρα.');
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

/** CSV download (Excel-compatible) combining bus seats + airline PNR details. */
export function exportHybridManifestCsv({ tripTitle, seats = [], flights = [] }) {
  const flightMap = Object.fromEntries((flights || []).map((f) => [f.id, f]));
  const header = [
    'Passenger',
    'GroundSeat',
    'FlightNumber',
    'FlightSeat',
    'PNR',
    'Ticket',
    'Route',
  ];
  const lines = [header.join(';')];
  for (const s of seats) {
    const fl = flightMap[s.flight_id] || {};
    const cols = [
      s.passenger_name || '',
      s.ground_seat || '',
      fl.flight_number || '',
      s.flight_seat || '',
      s.pnr_code || fl.pnr_code || '',
      s.ticket_code || '',
      fl.departure_airport && fl.arrival_airport
        ? `${fl.departure_airport}-${fl.arrival_airport}`
        : '',
    ].map(csvEscape);
    lines.push(cols.join(';'));
  }
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `manifest-${slugify(tripTitle || 'trip')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9α-ωά-ώ]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'trip';
}
