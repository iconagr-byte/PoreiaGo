import { useEffect, useState } from 'react';
import { issueSignedQrToken } from '../lib/ticketing/qrToken.js';
import { isBookingPaid } from '../lib/ticketing/bookingStore.js';

/**
 * Generates signed QR payload on-the-fly (recommended — no base64 stored in DB).
 * @param {import('../lib/ticketing/bookingStore.js').BookingRecord | null} booking
 */
export function useTicketQr(booking) {
  const [qrValue, setQrValue] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!booking) {
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
        const token = await issueSignedQrToken(booking);
        if (!cancelled) setQrValue(token);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [booking?.id, booking?.paymentStatus, booking?.checkInStatus]);

  return { qrValue, loading, error };
}
