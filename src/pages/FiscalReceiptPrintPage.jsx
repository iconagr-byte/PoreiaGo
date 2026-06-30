import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import FiscalReceiptCard from '../components/fiscal/FiscalReceiptCard.jsx';
import { getBookingById } from '../lib/ticketing/bookingStore.js';
import { getCustomerToken } from '../lib/auth.js';
import { bookingFiscalDocuments } from '../lib/fiscal/fiscalReceiptPrint.js';
import { fetchCustomerBookingFiscal } from '../services/customerBookingsApi.js';

export default function FiscalReceiptPrintPage() {
  const { bookingId } = useParams();
  const location = useLocation();
  const [payload, setPayload] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        let booking = location.state?.booking || getBookingById(bookingId);
        let fiscal = {};

        if (getCustomerToken()) {
          try {
            fiscal = await fetchCustomerBookingFiscal(bookingId);
          } catch {
            /* offline / admin without customer session */
          }
        }

        const merged = { ...(booking || {}), ...fiscal };
        const documents = bookingFiscalDocuments(merged).filter((d) => d.mark);

        if (!documents.length) {
          if (!cancelled) setLoadError('no_mark');
          return;
        }

        if (!cancelled) {
          setPayload({
            booking: merged,
            documents,
            issuerName: merged.issuer_name || merged.issuerName,
            issuerVat: merged.issuer_vat || merged.issuerVat,
          });
        }
      } catch (err) {
        console.error('[FiscalReceiptPrintPage]', err);
        if (!cancelled) setLoadError('crash');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookingId, location.state]);

  if (!payload && !loadError) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Φόρτωση απόδειξης…</p>
      </div>
    );
  }

  if (loadError === 'no_mark') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-3">
          <p className="text-amber-800 font-bold">Δεν υπάρχει εκδοθέν MARK για αυτή την κράτηση.</p>
          <p className="text-sm text-gray-600">
            Η απόδειξη εμφανίζεται μόνο αφού ολοκληρωθεί η έκδοση στο myDATA.
          </p>
          <Link to="/wallet" className="text-[#0040df] font-bold text-sm inline-block">
            Πίσω στο Wallet
          </Link>
        </div>
      </div>
    );
  }

  if (loadError === 'crash' || !payload) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8 text-center">
        <p className="text-red-600 font-bold">Σφάλμα φόρτωσης απόδειξης.</p>
      </div>
    );
  }

  const { booking, documents, issuerName, issuerVat } = payload;

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 print:bg-white print:py-0">
      <style>{`
        @media print {
          .no-print-receipt { display: none !important; }
        }
      `}</style>

      <div className="max-w-lg mx-auto space-y-8">
        <div className="no-print-receipt text-center space-y-3">
          <h1 className="text-xl font-bold text-gray-900">Φορολογική απόδειξη</h1>
          <p className="text-sm text-gray-500">Ctrl+P → «Αποθήκευση ως PDF»</p>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-700 text-white font-bold text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            Αποθήκευση PDF
          </button>
        </div>

        {documents.map((doc) => (
          <FiscalReceiptCard
            key={`${doc.mark}-${doc.kind}`}
            document={doc}
            booking={booking}
            issuerName={issuerName}
            issuerVat={issuerVat}
          />
        ))}

        <p className="no-print-receipt text-center text-sm">
          <Link to="/wallet" className="text-[#0040df] font-bold hover:underline">
            Πίσω στο Wallet
          </Link>
        </p>
      </div>
    </div>
  );
}
