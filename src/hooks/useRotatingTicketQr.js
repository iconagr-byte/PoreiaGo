import { useEffect, useState, useRef } from 'react';
import { API_BASE } from '../config/api.js';
import { isBookingPaid } from '../lib/ticketing/bookingStore.js';
import { bookingIdAliases, localIdFromReference } from '../lib/ticketing/bookingIds.js';
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
        const ids = bookingIdAliases(booking.id);
        if (booking.pnr) {
          const fromPnr = localIdFromReference(booking.pnr);
          if (fromPnr && !ids.includes(fromPnr)) ids.unshift(fromPnr);
          if (!ids.includes(booking.pnr)) ids.push(booking.pnr);
        }
        let data = null;
        let lastDetail = 'QR fetch failed';
        const responses = await Promise.all(
          ids.map((id) => fetch(`${API_BASE}/api/tickets/${encodeURIComponent(id)}/qr`)),
        );
        for (const res of responses) {
          if (res.ok) {
            data = await res.json();
            break;
          }
          const err = await res.json().catch(() => ({}));
          lastDetail = err.detail || lastDetail;
        }
        if (!data) throw new Error(lastDetail);
        if (!cancelled) {
          setQrValue(data.token);
          setExpiresIn(data.expires_in ?? 30);
        }
      } catch {
        try {
          const token = await issueSignedQrToken({
            ...booking,
            id: localIdFromReference(booking.pnr || booking.id) || booking.id,
          });
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
