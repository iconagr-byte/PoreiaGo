/**
 * Printable passenger manifest (browser print → Save as PDF).
 */
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function exportTripManifestPdf({ tripTitle, date, bookings, companyName = 'PoreiaGo Travel' }) {
  const rows = (bookings || [])
    .map(
      (b, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(b.customerName || b.user || '—')}</td>
      <td>${escapeHtml(b.seat || (b.seats || []).join(', ') || '—')}</td>
      <td>${escapeHtml(b.pnr || b.id)}</td>
      <td>€${Number(b.price || 0).toFixed(2)}</td>
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
    .meta { color: #555; font-size: 0.85rem; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
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
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Επιβάτης</th>
        <th>Θέση</th>
        <th>PNR</th>
        <th>Τιμή</th>
        <th>Check-in</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="6">Δεν υπάρχουν κρατήσεις</td></tr>'}</tbody>
  </table>
  <p class="foot">Εμπιστευτικό — εσωτερική χρήση διαχείρισης στόλου.</p>
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
