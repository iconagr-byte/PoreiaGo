import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { fetchCustomerBookingFiscal } from '../../services/customerBookingsApi.js';
import { getCustomerToken } from '../auth.js';
import { bookingFiscalMark, bookingFiscalReceipts, bookingFiscalStatus } from './fiscalDisplay.js';

const POLL_MS = 5000;
const MAX_POLLS = 24;

function hasPendingFiscal(booking) {
  const status = bookingFiscalStatus(booking);
  if (status === 'pending') return true;
  return bookingFiscalReceipts(booking).some((r) => {
    const s = String(r.status || '').toLowerCase();
    return s === 'pending' || s === 'queued';
  });
}

/** Poll customer fiscal endpoint until MARK is issued or timeout. */
export function useCustomerFiscalPoll(booking, { enabled = false, onUpdated } = {}) {
  const pollsRef = useRef(0);
  const hadMarkRef = useRef(Boolean(bookingFiscalMark(booking)));

  useEffect(() => {
    hadMarkRef.current = Boolean(bookingFiscalMark(booking));
  }, [booking?.id]);

  useEffect(() => {
    pollsRef.current = 0;
    if (!enabled || !booking?.id || !getCustomerToken() || !hasPendingFiscal(booking)) {
      return undefined;
    }

    const tick = async () => {
      pollsRef.current += 1;
      try {
        const fiscal = await fetchCustomerBookingFiscal(booking.id);
        const fresh = { ...booking, ...fiscal };
        const mark = bookingFiscalMark(fresh);
        if (mark && !hadMarkRef.current) {
          hadMarkRef.current = true;
          toast.success(`Η φορολογική απόδειξή σας εκδόθηκε · MARK ${mark}`);
        }
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
