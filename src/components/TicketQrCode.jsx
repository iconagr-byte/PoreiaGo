import { QRCode } from 'react-qr-code';
import { useRotatingTicketQr } from '../hooks/useRotatingTicketQr.js';

/**
 * Renders signed ticket QR on-the-fly (nothing stored in DB except booking id).
 */
export default function TicketQrCode({ booking, size = 150, className = '' }) {
  const { qrValue, expiresIn, loading, error } = useRotatingTicketQr(booking);

  if (!booking) return null;

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 rounded-2xl ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-xs text-gray-400">Φόρτωση QR…</span>
      </div>
    );
  }

  if (error === 'unpaid') {
    return (
      <div
        className={`flex items-center justify-center bg-orange-50 rounded-2xl border border-orange-200 ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-xs text-orange-700 text-center px-2">Εκκρεμής πληρωμή</span>
      </div>
    );
  }

  if (!qrValue) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 rounded-2xl border border-gray-200 ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-xs text-gray-500 text-center px-2">Δεν φορτώθηκε QR</span>
      </div>
    );
  }

  return (
    <div className={`bg-white p-3 rounded-2xl ${className}`}>
      <QRCode value={qrValue} size={size} level="M" />
      <p className="text-[10px] text-center text-gray-400 mt-2">
        Ανανεώνεται κάθε 30s · λήγει σε {expiresIn}s
      </p>
    </div>
  );
}
