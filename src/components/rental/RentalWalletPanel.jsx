/**
 * Rent Wallet — featured rental pass + stack of other vehicle bookings.
 * Separate from bus My Wallet (/wallet).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  cancelCustomerRentalBooking,
  fetchMyRentalBookings,
} from '../../services/customerRentalApi.js';
import RentalWalletPass from './RentalWalletPass.jsx';

const STATUS_LABEL = {
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
  const status = b.rental_status || '';
  if (status === 'ACTIVE') return 0;
  if (status === 'CONFIRMED') return 1;
  if (status === 'COMPLETED') return 2;
  return 3;
}

function sortBookings(rows) {
  return [...rows].sort((a, b) => {
    const rank = rankBooking(a) - rankBooking(b);
    if (rank !== 0) return rank;
    return String(b.start_time || '').localeCompare(String(a.start_time || ''));
  });
}

export default function RentalWalletPanel({
  brandLabel = 'Rent Wallet',
  passengerName = '',
  refreshKey = 0,
  onBookVehicle,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchMyRentalBookings();
      const sorted = sortBookings(list || []);
      setRows(sorted);
      setSelectedId((prev) => {
        if (prev && sorted.some((b) => b.id === prev)) return prev;
        return sorted[0]?.id || '';
      });
    } catch (err) {
      toast.error(err.message || 'Αποτυχία φόρτωσης κρατήσεων');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const featured = useMemo(
    () => rows.find((b) => b.id === selectedId) || rows[0] || null,
    [rows, selectedId],
  );
  const others = useMemo(
    () => rows.filter((b) => b.id !== featured?.id),
    [rows, featured],
  );

  const cancelBooking = async (booking) => {
    if (!booking?.id) return;
    if (!window.confirm('Να ακυρωθεί αυτή η κράτηση;')) return;
    setBusyId(booking.id);
    try {
      await cancelCustomerRentalBooking(booking.id);
      toast.success('Η κράτηση ακυρώθηκε');
      await load();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία ακύρωσης');
    } finally {
      setBusyId('');
    }
  };

  if (loading && !rows.length) {
    return <p className="rent-panel-lead">Φόρτωση Rent Wallet…</p>;
  }

  return (
    <div className="rent-wallet">
      <RentalWalletPass
        booking={featured}
        brandLabel={brandLabel}
        passengerName={passengerName}
        onBookVehicle={onBookVehicle}
        onCancel={cancelBooking}
        cancelling={busyId === featured?.id}
      />

      {others.length ? (
        <section className="wallet-home-more rent-wallet-more" aria-label="Άλλες ενοικιάσεις">
          <h3 className="rent-wallet-more-title">Άλλες κρατήσεις</h3>
          <div className="wallet-list">
            {others.map((b) => (
              <button
                key={b.id}
                type="button"
                className="wallet-booking-card rent-wallet-card-btn"
                onClick={() => setSelectedId(b.id)}
              >
                <div className="wallet-booking-body">
                  <h3>
                    {b.vehicle_model || 'Όχημα'} · {b.vehicle_plate || '—'}
                  </h3>
                  <p>
                    {formatWhen(b.start_time)} → {formatWhen(b.end_time)}
                  </p>
                  <p className="wallet-booking-mono">
                    {b.pickup_location || 'Γραφείο'}
                    {` · €${Number(b.total_cost || 0).toFixed(2)} · ${
                      STATUS_LABEL[b.rental_status] || b.rental_status
                    }`}
                  </p>
                </div>
                <span className="material-symbols-outlined" aria-hidden>
                  chevron_right
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
