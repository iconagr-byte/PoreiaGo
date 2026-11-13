import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { customerRentalCheckIn } from '../../services/customerRentalApi.js';
import {
  DEMO_RENT_BOOKING_ID,
  writeDemoRentCheckinReady,
} from '../../lib/rental/demoRentBooking.js';
import { isSoftNativeRentDemoToken } from '../../lib/rental/nativeRentDemo.js';

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('el-GR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function canCheckIn(booking) {
  if (!booking) return false;
  if (booking.online_checkin_ready) return false;
  const status = String(booking.rental_status || '').toUpperCase();
  return status === 'CONFIRMED' || status === 'RESERVED' || status === 'ACTIVE';
}

/**
 * Member check-in bottom sheet — from a rental booking card (not a tab).
 * PoreiaGo teal/deep palette; layout inspired by clean rental check-in sheets.
 */
export default function RentMemberCheckinSheet({
  booking,
  brandLabel = 'Γραφείο',
  onClose,
  onCheckedIn,
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(Boolean(booking?.online_checkin_ready));

  useEffect(() => {
    setDone(Boolean(booking?.online_checkin_ready));
  }, [booking?.id, booking?.online_checkin_ready]);

  useEffect(() => {
    if (!booking) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [booking, onClose]);

  if (!booking || typeof document === 'undefined') return null;

  const ref =
    booking.reference_code ||
    (booking.id ? `RB-${String(booking.id).replace(/-/g, '').slice(0, 8).toUpperCase()}` : '—');
  const pickup = booking.pickup_location || brandLabel || 'Γραφείο';
  const dropoff = booking.dropoff_location || pickup;

  const submit = async () => {
    if (done || busy) return;
    if (!canCheckIn(booking) && !done) {
      toast.error('Το check-in δεν είναι διαθέσιμο για αυτή την κράτηση.');
      return;
    }
    setBusy(true);
    try {
      if (isSoftNativeRentDemoToken() || booking.id === DEMO_RENT_BOOKING_ID) {
        if (booking.id === DEMO_RENT_BOOKING_ID) writeDemoRentCheckinReady(true);
        const soft = {
          ...booking,
          online_checkin_ready: true,
          online_checkin_at: new Date().toISOString(),
        };
        setDone(true);
        onCheckedIn?.(soft);
        toast.success('Check-in ολοκληρώθηκε (demo)');
        return;
      }
      const data = await customerRentalCheckIn(booking.id);
      const row = data?.booking || { ...booking, online_checkin_ready: true };
      setDone(true);
      onCheckedIn?.(row);
      toast.success('Check-in ολοκληρώθηκε');
    } catch (err) {
      toast.error(err?.message || 'Αποτυχία check-in');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="rent-member-checkin-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Online check-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="rent-member-checkin-sheet">
        <div className="rent-member-checkin-handle" aria-hidden />
        <header className="rent-member-checkin-bar">
          <h2>Online Check-in</h2>
          <button
            type="button"
            className="rent-member-checkin-close"
            aria-label="Κλείσιμο"
            onClick={onClose}
          >
            <span className="material-symbols-outlined" aria-hidden>
              close
            </span>
          </button>
        </header>

        <div className="rent-member-checkin-body">
          <h3>{done ? 'Είσαι έτοιμος για παραλαβή.' : 'Check-in, και φεύγεις.'}</h3>
          <p>
            {done
              ? `Το ${brandLabel} βλέπει ήδη το online check-in σου. Φέρε άδεια οδήγησης και ταυτότητα ή διαβατήριο.`
              : 'Η άφιξή σου είναι προτεραιότητα. Κάνε check-in τώρα για πιο γρήγορη παραλαβή — λίγα λεπτά αρκούν.'}
          </p>

          <div className="rent-member-checkin-card">
            <p className="rent-member-checkin-ref">
              Κωδικός κράτησης: <strong>{ref}</strong>
            </p>
            <p className="rent-member-checkin-vehicle">
              {booking.vehicle_model || 'Όχημα'}
              {booking.vehicle_plate ? ` · ${booking.vehicle_plate}` : ''}
            </p>
            <ul className="rent-member-checkin-legs">
              <li>
                <span className="material-symbols-outlined" aria-hidden>
                  location_on
                </span>
                <div>
                  <strong>{pickup}</strong>
                  <span>{formatWhen(booking.start_time)}</span>
                </div>
              </li>
              <li>
                <span className="material-symbols-outlined" aria-hidden>
                  flag
                </span>
                <div>
                  <strong>{dropoff}</strong>
                  <span>{formatWhen(booking.end_time)}</span>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <footer className="rent-member-checkin-foot">
          {done ? (
            <button type="button" className="rent-member-checkin-cta" onClick={onClose}>
              Εντάξει
            </button>
          ) : (
            <button
              type="button"
              className="rent-member-checkin-cta"
              disabled={busy || !canCheckIn(booking)}
              onClick={submit}
            >
              {busy ? 'Ολοκλήρωση…' : 'Check-in τώρα'}
            </button>
          )}
          <p>{done ? 'Καλή διαδρομή' : 'Σε περιμένουμε στην παραλαβή'}</p>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

export { canCheckIn };
