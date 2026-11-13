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
 * Online check-in bottom sheet — opened from a rental booking / Ενοικιάσεις card.
 * Structure inspired by clean member check-in sheets; PoreiaGo teal/deep only
 * (no Hertz yellow / brand copy).
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
  const vehicleLine = [booking.vehicle_model, booking.vehicle_plate].filter(Boolean).join(' · ');

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
        <div className="rent-member-checkin-wash" aria-hidden />
        <div className="rent-member-checkin-handle" aria-hidden />
        <header className="rent-member-checkin-bar">
          <p className="rent-member-checkin-kicker">Online Check-in</p>
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
          <p className="rent-member-checkin-brand">{brandLabel}</p>
          <h2>
            {done ? 'Είσαι έτοιμος για παραλαβή.' : 'Check-in πριν φτάσεις.'}
          </h2>
          <p className="rent-member-checkin-lead">
            {done
              ? `Το ${brandLabel} βλέπει ήδη το online check-in σου. Φέρε άδεια οδήγησης και ταυτότητα ή διαβατήριο.`
              : 'Ολοκλήρωσε τα στοιχεία τώρα — στην παραλαβή περνάς πιο γρήγορα, χωρίς ουρά στο γκισέ.'}
          </p>

          <div className="rent-member-checkin-card">
            <div className="rent-member-checkin-card-top">
              <span>Κράτηση</span>
              <strong>{ref}</strong>
            </div>
            {vehicleLine ? (
              <p className="rent-member-checkin-vehicle">{vehicleLine}</p>
            ) : null}
            <ul className="rent-member-checkin-legs">
              <li>
                <span className="material-symbols-outlined" aria-hidden>
                  trip_origin
                </span>
                <div>
                  <em>Παραλαβή</em>
                  <strong>{pickup}</strong>
                  <span>{formatWhen(booking.start_time)}</span>
                </div>
              </li>
              <li>
                <span className="material-symbols-outlined" aria-hidden>
                  flag
                </span>
                <div>
                  <em>Επιστροφή</em>
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
              {busy ? 'Ολοκλήρωση…' : 'Ξεκίνα check-in'}
            </button>
          )}
          <p>{done ? 'Καλή διαδρομή' : 'Χωρίς επιπλέον χρέωση · 2–3 λεπτά'}</p>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

export { canCheckIn };
