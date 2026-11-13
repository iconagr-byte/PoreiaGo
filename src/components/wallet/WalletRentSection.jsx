/**
 * Compact rent summary inside unified My Wallet when the office has rent_enabled.
 * Apple-wallet aesthetics — check-in first, secondary links quiet.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyRentalBookings } from '../../services/customerRentalApi.js';
import {
  DEMO_RENT_BOOKING_ID,
  resetDemoRentCheckinReady,
  withDemoRentBookings,
} from '../../lib/rental/demoRentBooking.js';
import RentMemberCheckinSheet, { canCheckIn } from '../rental/RentMemberCheckinSheet.jsx';

const STATUS_LABEL = {
  RESERVED: 'Εκκρεμεί πληρωμή',
  CONFIRMED: 'Επιβεβαιωμένη',
  ACTIVE: 'Σε εξέλιξη',
  COMPLETED: 'Ολοκληρωμένη',
  CANCELLED: 'Ακυρωμένη',
};

function formatDay(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('el-GR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return iso;
  }
}

function formatClock(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('el-GR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function rankBooking(b) {
  const status = b?.rental_status || '';
  if (status === 'ACTIVE') return 0;
  if (status === 'CONFIRMED') return 1;
  if (status === 'RESERVED') return 2;
  if (status === 'COMPLETED') return 3;
  return 4;
}

function hasCheckinEntry(booking) {
  if (!booking) return false;
  const status = String(booking.rental_status || '').toUpperCase();
  return status === 'CONFIRMED' || status === 'RESERVED' || status === 'ACTIVE';
}

export default function WalletRentSection({
  compact = false,
  brandLabel = 'Γραφείο',
  onOpenRentals = null,
} = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkinBooking, setCheckinBooking] = useState(null);

  useEffect(() => {
    let cancelled = false;
    resetDemoRentCheckinReady();
    fetchMyRentalBookings()
      .then((list) => {
        if (cancelled) return;
        const seeded = withDemoRentBookings(list || [], { brandLabel });
        const sorted = [...seeded].sort((a, b) => {
          const rank = rankBooking(a) - rankBooking(b);
          if (rank !== 0) return rank;
          return String(b.start_time || '').localeCompare(String(a.start_time || ''));
        });
        setRows(sorted);
      })
      .catch(() => {
        if (cancelled) return;
        setRows(withDemoRentBookings([], { brandLabel }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [brandLabel]);

  const featured = rows[0] || null;
  const statusLabel = featured
    ? STATUS_LABEL[featured.rental_status] || featured.rental_status
    : '';
  const checkinOpen = Boolean(featured && hasCheckinEntry(featured));
  const checkinPending = Boolean(featured && canCheckIn(featured));
  const checkinDone = Boolean(featured?.online_checkin_ready);

  const openRentals = () => {
    if (typeof onOpenRentals === 'function') onOpenRentals();
  };

  const openCheckin = () => {
    if (!featured) return;
    setCheckinBooking(featured);
  };

  const hookTitle = checkinPending
    ? 'Check-in πριν φτάσεις.'
    : checkinDone
      ? 'Είσαι έτοιμος για παραλαβή.'
      : 'Οι ενοικιάσεις σου.';
  const hookLead = checkinPending
    ? 'Ολοκλήρωσε online σε 2 λεπτά — στην παραλαβή περνάς χωρίς ουρά.'
    : checkinDone
      ? 'Το γραφείο βλέπει ήδη το check-in σου. Φέρε άδεια και ταυτότητα.'
      : 'Κρατήσεις οχήματος από το γραφείο σας, στο ίδιο Wallet.';

  return (
    <section
      className={`wallet-panel wallet-rent-section wallet-rent-section--apple${
        compact ? ' wallet-rent-section--compact' : ''
      }${checkinOpen ? ' wallet-rent-section--checkin' : ''}`}
      aria-label="Ενοικιάσεις"
    >
      <div className="wallet-rent-apple-head">
        <div className="wallet-panel-head">
          <span className="wallet-panel-head-icon" aria-hidden>
            <span className="material-symbols-outlined">directions_car</span>
          </span>
          <div>
            <h2>Ενοικιάσεις</h2>
            <p>
              {loading
                ? 'Φόρτωση…'
                : rows.length
                  ? `${rows.length} ${rows.length === 1 ? 'κράτηση' : 'κρατήσεις'} οχήματος`
                  : 'Κρατήσεις οχήματος από το γραφείο σας'}
            </p>
          </div>
        </div>

        {!loading && featured ? (
          <div className="wallet-rent-apple-hook">
            <p className="wallet-rent-apple-kicker">
              {checkinPending ? 'Online Check-in' : checkinDone ? 'Check-in έτοιμο' : brandLabel}
            </p>
            <h3>{hookTitle}</h3>
            <p className="wallet-rent-apple-lead">{hookLead}</p>
          </div>
        ) : null}
      </div>

      {!loading && featured ? (
        <button
          type="button"
          className={`wallet-rent-pass${checkinOpen ? ' is-live' : ''}${
            checkinDone ? ' is-done' : ''
          }`}
          onClick={() => {
            if (checkinOpen) openCheckin();
            else openRentals();
          }}
        >
          <div className="wallet-rent-pass-wash" aria-hidden />
          <div className="wallet-rent-pass-top">
            <span className="wallet-rent-pass-chip">{statusLabel}</span>
            {checkinDone ? (
              <span className="wallet-rent-pass-badge">
                <span className="material-symbols-outlined" aria-hidden>
                  task_alt
                </span>
                Έτοιμο
              </span>
            ) : checkinPending ? (
              <span className="wallet-rent-pass-badge is-pending">
                <span className="material-symbols-outlined" aria-hidden>
                  bolt
                </span>
                Γρήγορα
              </span>
            ) : null}
          </div>

          <p className="wallet-rent-pass-model">{featured.vehicle_model || 'Όχημα'}</p>
          {featured.vehicle_plate ? (
            <p className="wallet-rent-pass-plate">{featured.vehicle_plate}</p>
          ) : null}

          <div className="wallet-rent-pass-legs">
            <div>
              <em>Παραλαβή</em>
              <strong>{formatDay(featured.start_time)}</strong>
              <span>{formatClock(featured.start_time)}</span>
            </div>
            <span className="wallet-rent-pass-sep material-symbols-outlined" aria-hidden>
              arrow_forward
            </span>
            <div>
              <em>Επιστροφή</em>
              <strong>{formatDay(featured.end_time)}</strong>
              <span>{formatClock(featured.end_time)}</span>
            </div>
          </div>

          <div className="wallet-rent-pass-foot">
            <span>
              {featured.pickup_location || brandLabel}
              {featured.reference_code ? ` · ${featured.reference_code}` : ''}
            </span>
            <span className="material-symbols-outlined" aria-hidden>
              chevron_right
            </span>
          </div>
        </button>
      ) : null}

      <div className="wallet-rent-actions">
        {checkinOpen ? (
          <button
            type="button"
            className="wallet-btn wallet-btn-primary wallet-btn-block wallet-rent-checkin-cta"
            onClick={openCheckin}
          >
            {checkinPending ? 'Check-in τώρα' : 'Δες το check-in'}
          </button>
        ) : null}

        <div className="wallet-rent-secondary">
          {typeof onOpenRentals === 'function' ? (
            <button type="button" className="wallet-rent-link" onClick={openRentals}>
              Οι ενοικιάσεις μου
            </button>
          ) : (
            <Link to="/wallet?tab=rentals" className="wallet-rent-link">
              Οι ενοικιάσεις μου
            </Link>
          )}
          {!compact ? (
            <>
              <span className="wallet-rent-dot" aria-hidden>
                ·
              </span>
              <Link to="/rent" className="wallet-rent-link">
                Βρες όχημα
              </Link>
            </>
          ) : null}
        </div>
      </div>

      <RentMemberCheckinSheet
        booking={checkinBooking}
        brandLabel={brandLabel}
        onClose={() => setCheckinBooking(null)}
        onCheckedIn={(row) => {
          setRows((list) =>
            list.map((item) => (item.id === row.id ? { ...item, ...row } : item)),
          );
          setCheckinBooking((cur) => (cur && cur.id === row.id ? { ...cur, ...row } : cur));
          if (row.id === DEMO_RENT_BOOKING_ID) {
            /* session flag written in sheet */
          }
        }}
      />
    </section>
  );
}
