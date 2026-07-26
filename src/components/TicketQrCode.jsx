import { useEffect, useRef } from 'react';
import { QRCode } from 'react-qr-code';
import { useRotatingTicketQr } from '../hooks/useRotatingTicketQr.js';
import { svgElementToDataUrl } from '../lib/wallet/qrSnapshot.js';

/**
 * Renders signed ticket QR on-the-fly (nothing stored in DB except booking id).
 * Optional onQrChange({ qrValue, qrDataUrl }) for offline wallet snapshot.
 */
export default function TicketQrCode({ booking, size = 150, className = '', onQrChange }) {
  const { qrValue, expiresIn, loading, error } = useRotatingTicketQr(booking);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!onQrChange || !qrValue) return undefined;
    const id = window.requestAnimationFrame(() => {
      const svg = wrapRef.current?.querySelector('svg');
      onQrChange({
        qrValue,
        qrDataUrl: svgElementToDataUrl(svg),
        bookingId: booking?.id,
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [qrValue, onQrChange, booking?.id]);

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
    <div ref={wrapRef} className={`bg-white p-3 rounded-2xl ${className}`}>
      <QRCode value={qrValue} size={size} level="M" />
      <p className="text-[10px] text-center text-gray-400 mt-2">
        Ανανεώνεται κάθε 30s · λήγει σε {expiresIn}s
      </p>
    </div>
  );
}
