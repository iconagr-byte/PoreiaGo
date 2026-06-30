import { useEffect, useState, useRef } from 'react';
import { API_BASE } from '../config/api.js';
import { isBookingPaid } from '../lib/ticketing/bookingStore.js';
import { issueSignedQrToken } from '../lib/ticketing/qrToken.js';

/**
 * Polls FastAPI for a new rotating JWT every ~25s (30s TOTP window).
 * QR contains only opaque ref — no PII.
 */
export function useRotatingTicketQr(booking) {
  const [qrValue, setQrValue] = useState('');
  const [expiresIn, setExpiresIn] = useState(30);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchQr() {
      if (!booking?.id) {
        setQrValue('');
        return;
      }
      if (!isBookingPaid(booking)) {
        setQrValue('');
        setError('unpaid');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/tickets/${booking.id}/qr`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'QR fetch failed');
        }
        const data = await res.json();
        if (!cancelled) {
          setQrValue(data.token);
          setExpiresIn(data.expires_in ?? 30);
        }
      } catch {
        try {
          const token = await issueSignedQrToken(booking);
          if (!cancelled) {
            setQrValue(token);
            setExpiresIn(30);
            setError(null);
          }
        } catch (e) {
          if (!cancelled) setError(e.message || 'QR fetch failed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchQr();
    timerRef.current = setInterval(fetchQr, 25000);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [booking?.id, booking?.paymentStatus]);

  return { qrValue, expiresIn, loading, error };
}
