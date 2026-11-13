/**
 * Compact rent summary inside unified My Wallet when the office has rent_enabled.
 * Opens the rentals tab in the same shell — not a second /rent/wallet app.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyRentalBookings } from '../../services/customerRentalApi.js';
import { withDemoRentBookings } from '../../lib/rental/demoRentBooking.js';
import RentMemberCheckinSheet, { canCheckIn } from '../rental/RentMemberCheckinSheet.jsx';

const STATUS_LABEL = {
  RESERVED: 'Εκκρεμεί πληρωμή',
  CONFIRMED: 'Επιβεβαιωμένη',
  ACTIVE: 'Σε εξέλιξη',
  COMPLETED: 'Ολοκληρωμένη',
  CANCELLED: 'Ακυρωμένη',
};

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

function rankBooking(b) {
  const status = b?.rental_status || '';
  if (status === 'ACTIVE') return 0;
  if (status === 'CONFIRMED') return 1;
  if (status === 'RESERVED') return 2;
  if (status === 'COMPLETED') return 3;
  return 4;
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
        const seeded = withDemoRentBookings([], { brandLabel });
        setRows(seeded);
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
  const showCheckin = Boolean(featured && canCheckIn(featured));

  const openRentals = () => {
    if (typeof onOpenRentals === 'function') onOpenRentals();
  };

  return (
    <section
      className={`wallet-panel wallet-rent-section${compact ? ' wallet-rent-section--compact' : ''}${
        showCheckin ? ' wallet-rent-section--checkin' : ''
      }`}
      aria-label="Ενοικιάσεις"
    >
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
        <button
          type="button"
          className={`wallet-rent-featured${showCheckin ? ' wallet-rent-featured--checkin' : ''}`}
          onClick={() => {
            if (showCheckin) setCheckinBooking(featured);
            else if (typeof onOpenRentals === 'function') openRentals();
          }}
        >
          <div className="wallet-rent-featured-copy">
            <p className="wallet-rent-featured-title">
              {featured.vehicle_model || 'Όχημα'}
              {featured.vehicle_plate ? (
                <span className="wallet-rent-featured-plate"> · {featured.vehicle_plate}</span>
              ) : null}
            </p>
            <p className="wallet-rent-featured-meta">
              {statusLabel}
              {' · '}
              {formatWhen(featured.start_time)}
              {featured.online_checkin_ready ? ' · Check-in έτοιμο' : ''}
            </p>
            {showCheckin ? (
              <p className="wallet-rent-featured-hook">Online check-in διαθέσιμο</p>
            ) : null}
          </div>
          {showCheckin ? (
            <span className="wallet-rent-featured-chevron material-symbols-outlined" aria-hidden>
              chevron_right
            </span>
          ) : null}
        </button>
      ) : null}

      <div className="wallet-rent-actions">
        {showCheckin ? (
          <button
            type="button"
            className="wallet-btn wallet-btn-primary wallet-btn-block wallet-rent-checkin-cta"
            onClick={() => setCheckinBooking(featured)}
          >
            Check-in τώρα
          </button>
        ) : null}
        {typeof onOpenRentals === 'function' ? (
          <button
            type="button"
            className={`wallet-btn wallet-btn-block${
              showCheckin ? ' wallet-btn-ghost' : ' wallet-btn-primary'
            }`}
            onClick={openRentals}
          >
            Οι ενοικιάσεις μου
          </button>
        ) : (
          <Link
            to="/wallet?tab=rentals"
            className={`wallet-btn wallet-btn-block${
              showCheckin ? ' wallet-btn-ghost' : ' wallet-btn-primary'
            }`}
          >
            Οι ενοικιάσεις μου
          </Link>
        )}
        {!compact ? (
          <Link to="/rent" className="wallet-btn wallet-btn-ghost wallet-btn-block">
            Βρες όχημα
          </Link>
        ) : null}
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
        }}
      />
    </section>
  );
}
