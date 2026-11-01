/**
 * Compact rent summary inside bus My Wallet when the office has rent_enabled.
 * Full Rent Wallet lives at /rent/wallet — this is a bridge, not a second app.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyRentalBookings } from '../../services/customerRentalApi.js';

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

export default function WalletRentSection({ compact = false } = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchMyRentalBookings()
      .then((list) => {
        if (cancelled) return;
        const sorted = [...(list || [])].sort((a, b) => {
          const rank = rankBooking(a) - rankBooking(b);
          if (rank !== 0) return rank;
          return String(b.start_time || '').localeCompare(String(a.start_time || ''));
        });
        setRows(sorted);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const featured = rows[0] || null;
  const statusLabel = featured
    ? STATUS_LABEL[featured.rental_status] || featured.rental_status
    : '';

  return (
    <section
      className={`wallet-panel wallet-rent-section${compact ? ' wallet-rent-section--compact' : ''}`}
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
        <div className="wallet-rent-featured">
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
          </p>
        </div>
      ) : null}

      <div className="wallet-rent-actions">
        <Link to="/rent/wallet" className="wallet-btn wallet-btn-primary wallet-btn-block">
          Άνοιγμα Rent Wallet
        </Link>
        {!compact ? (
          <Link to="/rent" className="wallet-btn wallet-btn-ghost wallet-btn-block">
            Βρες όχημα
          </Link>
        ) : null}
      </div>
    </section>
  );
}
