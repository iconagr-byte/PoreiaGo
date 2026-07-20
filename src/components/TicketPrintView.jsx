import { QRCode } from 'react-qr-code';
import { useEffect, useState } from 'react';
import { issueSignedQrToken } from '../lib/ticketing/qrToken.js';
import { isBookingPaid } from '../lib/ticketing/bookingStore.js';

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <div className="text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-1">{label}</div>
      <div>{children}</div>
    </div>
  );
}

/**
 * Inline boarding pass — visible on screen + printable (Ctrl+P).
 */
export default function TicketPrintView({ booking, trip, companyName = 'PoreiaGo Travel' }) {
  const [qrToken, setQrToken] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!booking || !isBookingPaid(booking)) {
      setError('Η κράτηση δεν είναι εξοφλημένη');
      return;
    }
    issueSignedQrToken(booking)
      .then((token) => {
        if (!cancelled) setQrToken(token);
      })
      .catch(() => {
        if (!cancelled) setQrToken(booking.pnr || booking.id || '');
      });
    return () => {
      cancelled = true;
    };
  }, [booking]);

  if (!booking) {
    return <p className="text-red-600 text-sm">Δεν βρέθηκε κράτηση.</p>;
  }

  const tripTitle = trip?.title || booking.tripTitle || 'Εκδρομή';
  const pnr = booking.pnr || booking.ticketRef || booking.id;
  const dateStr = booking.date
    ? new Date(booking.date).toLocaleDateString('el-GR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—';

  return (
    <div className="ticket-print-root">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .ticket-print-root, .ticket-print-root * { visibility: visible; }
          .ticket-print-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            background: white;
          }
          .no-print-ticket { display: none !important; }
        }
      `}</style>

      <div className="max-w-[420px] mx-auto bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-200">
        <div className="bg-gradient-to-br from-[#0040df] to-[#002a96] text-white px-6 py-5">
          <div className="text-[11px] uppercase tracking-widest opacity-85 mb-1">{companyName}</div>
          <h2 className="text-xl font-bold leading-tight m-0">{tripTitle}</h2>
          <p className="text-sm opacity-90 mt-2 mb-0">
            {dateStr} · Αναχώρηση {booking.time || '—'}
          </p>
        </div>

        <div className="relative h-5 bg-white">
          <div className="absolute left-[-10px] top-1/2 -translate-y-1/2 w-5 h-5 bg-gray-100 rounded-full border-r border-gray-200" />
          <div className="absolute right-[-10px] top-1/2 -translate-y-1/2 w-5 h-5 bg-gray-100 rounded-full border-l border-gray-200" />
          <div className="mx-6 border-t-2 border-dashed border-gray-200 absolute left-0 right-0 top-1/2" />
        </div>

        <div className="px-6 pb-6 pt-4">
          <div className="grid grid-cols-2 gap-4 mb-5">
            <Field label="Επιβάτης">
              <span className="font-bold text-gray-900">{booking.customerName}</span>
            </Field>
            <Field label="Θέση">
              <span className="font-bold text-2xl text-primary">{booking.seat || '—'}</span>
            </Field>
            <Field label="Κωδ. κράτησης (PNR)">
              <span className="font-mono text-sm font-bold">{pnr}</span>
            </Field>
            <Field label="Τιμή">
              <span className="font-bold">
                {booking.price != null ? `€${Number(booking.price).toFixed(2)}` : '—'}
              </span>
            </Field>
            <Field label="Τηλέφωνο">
              <span className="text-sm font-medium">{booking.phone || '—'}</span>
            </Field>
            <Field label="Τιμολόγιο">
              <span className="text-xs font-medium">{booking.invoiceNumber || '—'}</span>
            </Field>
          </div>

          <div className="border-t border-gray-100 pt-5 text-center">
            {error ? (
              <p className="text-orange-700 text-sm">{error}</p>
            ) : qrToken ? (
              <div className="inline-block p-3 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                <QRCode value={qrToken} size={180} level="M" />
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Φόρτωση QR…</p>
            )}
            <p className="font-mono font-extrabold text-lg tracking-widest mt-3 mb-1">{pnr}</p>
            <p className="text-[10px] text-gray-400">Σκανάρετε κατά την επιβίβαση</p>
          </div>

          <p className="text-[10px] text-gray-500 mt-4 pt-3 border-t border-gray-100 leading-relaxed">
            <strong className="text-gray-700">Σημαντικό:</strong> Φέρετε ταυτότητα. Άφιξη 15 λεπτά
            πριν. Κράτηση #{booking.id}
            {booking.email ? ` · ${booking.email}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
