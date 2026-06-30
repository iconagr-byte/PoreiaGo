import { useEffect, useRef } from 'react';
import { fetchAdminBooking } from '../../services/adminBookingsApi.js';
import { bookingFiscalReceipts, bookingFiscalStatus } from './fiscalDisplay.js';

const POLL_MS = 4000;
const MAX_POLLS = 30;

function hasPendingFiscal(booking) {
  const status = bookingFiscalStatus(booking);
  if (status === 'pending') return true;
  return bookingFiscalReceipts(booking).some((r) => {
    const s = String(r.status || '').toLowerCase();
    return s === 'pending' || s === 'queued';
  });
}

/** Poll admin booking until fiscal MARK is issued or timeout. */
export function useFiscalBookingPoll(booking, { enabled = false, onUpdated } = {}) {
  const pollsRef = useRef(0);

  useEffect(() => {
    pollsRef.current = 0;
    if (!enabled || !booking?.id || !hasPendingFiscal(booking)) return undefined;

    const tick = async () => {
      pollsRef.current += 1;
      try {
        const fresh = await fetchAdminBooking(booking.id);
        onUpdated?.(fresh);
        if (!hasPendingFiscal(fresh) || pollsRef.current >= MAX_POLLS) {
          clearInterval(timer);
        }
      } catch {
        if (pollsRef.current >= MAX_POLLS) clearInterval(timer);
      }
    };

    const timer = setInterval(tick, POLL_MS);
    return () => clearInterval(timer);
  }, [booking?.id, enabled, bookingFiscalStatus(booking), onUpdated]);
}
