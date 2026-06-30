import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

/** Hardcoded demo — no imports from bookingStore/tripStore (avoids circular load crashes). */
const DEMO_BOOKING = {
  id: 'B-1029',
  customerName: 'John Doe',
  tripTitle: 'Ημερήσια στα Μετέωρα',
  date: '2026-06-15',
  time: '08:00',
  seat: '4A',
  price: 45,
  phone: '+30 694 123 4567',
  email: 'john@example.com',
  pnr: 'MET26JDOE8A',
  invoiceNumber: 'INV-2026-00125',
};

function Field({ label, children }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-1">{label}</div>
      <div>{children}</div>
    </div>
  );
}

/** QR as img — avoids react-qr-code edge cases on some browsers. */
function TicketQr({ value }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(value)}&margin=10`;
  return (
    <img
      src={src}
      width={180}
      height={180}
      alt="QR εισιτηρίου"
      className="rounded-lg bg-white"
    />
  );
}

function TicketCard({ booking, tripTitle }) {
  const pnr = booking.pnr || booking.ticketRef || booking.id;
  const dateStr = booking.date
    ? new Date(`${booking.date}T12:00:00`).toLocaleDateString('el-GR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—';

  return (
    <div className="max-w-[420px] mx-auto bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-200 print:shadow-none">
      <div className="bg-gradient-to-br from-[#0040df] to-[#002a96] text-white px-6 py-5">
        <div className="text-[11px] uppercase tracking-widest opacity-90 mb-1">PoreiaGo Travel</div>
        <h2 className="text-xl font-bold leading-tight m-0">{tripTitle}</h2>
        <p className="text-sm opacity-90 mt-2 mb-0">
          {dateStr} · Αναχώρηση {booking.time || '—'}
        </p>
      </div>

      <div className="relative h-5 bg-white">
        <div className="mx-6 border-t-2 border-dashed border-gray-200 absolute left-0 right-0 top-1/2" />
      </div>

      <div className="px-6 pb-6 pt-4">
        <div className="grid grid-cols-2 gap-4 mb-5">
          <Field label="Επιβάτης">
            <span className="font-bold text-gray-900">{booking.customerName}</span>
          </Field>
          <Field label="Θέση">
            <span className="font-bold text-2xl text-[#0040df]">{booking.seat || '—'}</span>
          </Field>
          <Field label="PNR">
            <span className="font-mono text-sm font-bold">{pnr}</span>
          </Field>
          <Field label="Τιμή">
            <span className="font-bold">
              {booking.price != null ? `€${Number(booking.price).toFixed(2)}` : '—'}
            </span>
          </Field>
          <Field label="Τηλέφωνο">
            <span className="text-sm">{booking.phone || '—'}</span>
          </Field>
          <Field label="Τιμολόγιο">
            <span className="text-xs">{booking.invoiceNumber || '—'}</span>
          </Field>
        </div>

        <div className="border-t border-gray-100 pt-5 text-center">
          <div className="inline-block p-3 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
            <TicketQr value={String(pnr)} />
          </div>
          <p className="font-mono font-extrabold text-lg tracking-widest mt-3">{pnr}</p>
          <p className="text-[10px] text-gray-400">Σκανάρετε κατά την επιβίβαση</p>
        </div>

        <p className="text-[10px] text-gray-500 mt-4 pt-3 border-t border-gray-100">
          Κράτηση #{booking.id}
          {booking.email ? ` · ${booking.email}` : ''}
        </p>
      </div>
    </div>
  );
}

export default function TicketPrintPage() {
  const { bookingId: rawId } = useParams();
  const bookingId = decodeURIComponent(rawId || 'demo');
  const isDemo = !bookingId || bookingId === 'demo';

  const [resolved, setResolved] = useState(() =>
    isDemo ? { booking: DEMO_BOOKING, tripTitle: DEMO_BOOKING.tripTitle } : null,
  );
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (isDemo) {
      setResolved({ booking: DEMO_BOOKING, tripTitle: DEMO_BOOKING.tripTitle });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [{ getBookingById }, { getTripById }, { mockBookings }] = await Promise.all([
          import('../lib/ticketing/bookingStore.js'),
          import('../lib/trips/tripStore.js'),
          import('../data/mockData.js'),
        ]);
        const booking =
          getBookingById(bookingId) || mockBookings.find((b) => b.id === bookingId);
        if (!booking) {
          if (!cancelled) setLoadError('notfound');
          return;
        }
        const trip = getTripById(booking.tripId);
        if (!cancelled) {
          setResolved({
            booking,
            tripTitle: trip?.title || booking.tripTitle || 'Εκδρομή',
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
  }, [bookingId, isDemo]);

  if (!isDemo && !resolved && !loadError) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Φόρτωση εισιτηρίου…</p>
      </div>
    );
  }

  if (loadError === 'notfound') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-red-600 font-bold">Η κράτηση «{bookingId}» δεν βρέθηκε.</p>
          <Link to="/ticket/print/demo" className="text-[#0040df] font-bold text-sm mt-4 inline-block">
            Demo εισιτήριο
          </Link>
        </div>
      </div>
    );
  }

  if (loadError === 'crash' || !resolved) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-8 text-center gap-4">
        <p className="text-red-600 font-bold">Σφάλμα φόρτωσης.</p>
        <a href="/ticket-demo.html" className="text-[#0040df] font-bold">
          Άνοιγμα στατικού demo (ticket-demo.html)
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 print:bg-white print:py-0">
      <style>{`
        @media print {
          .no-print-ticket { display: none !important; }
        }
      `}</style>

      <div className="max-w-lg mx-auto space-y-6">
        <div className="no-print-ticket text-center space-y-3">
          <h1 className="text-xl font-bold text-gray-900">Εισιτήριο εκδρομής</h1>
          <p className="text-sm text-gray-500">Ctrl+P → Αποθήκευση ως PDF</p>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#0040df] text-white font-bold text-sm"
          >
            Εκτύπωση
          </button>
        </div>

        <TicketCard booking={resolved.booking} tripTitle={resolved.tripTitle} />

        <p className="no-print-ticket text-center text-sm">
          <Link to="/" className="text-[#0040df] font-bold hover:underline">
            Αρχική
          </Link>
          {' · '}
          <a href="/ticket-demo.html" className="text-[#0040df] font-bold hover:underline">
            HTML backup
          </a>
        </p>
      </div>
    </div>
  );
}
