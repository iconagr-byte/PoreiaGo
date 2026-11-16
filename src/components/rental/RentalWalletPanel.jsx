/**
 * Rent passes — featured rental pass + stack of other vehicle bookings.
 * Lives inside Κρατήσεις (/wallet?tab=bookings).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  cancelCustomerRentalBooking,
  demoOfficeRentalCancel,
  fetchMyRentalBookings,
} from '../../services/customerRentalApi.js';
import {
  cancelDemoRentBooking,
  isDemoRentBookingId,
  withDemoRentBookings,
} from '../../lib/rental/demoRentBooking.js';
import { isNativeRentDemo, isSoftNativeRentDemoToken } from '../../lib/rental/nativeRentDemo.js';
import {
  cancelBlockedMessage,
  isFreeCancelEligible,
} from '../../lib/rental/rentalCancel.js';
import RentMemberCheckinSheet, { canCheckIn } from './RentMemberCheckinSheet.jsx';
import RentalWalletPass from './RentalWalletPass.jsx';

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
  const status = b.rental_status || '';
  if (status === 'ACTIVE') return 0;
  if (status === 'CONFIRMED') return 1;
  if (status === 'RESERVED') return 2;
  if (status === 'COMPLETED') return 3;
  return 4;
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
  highlightBookingId = '',
  onBookVehicle,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [checkinBooking, setCheckinBooking] = useState(null);
  const [reminderShown, setReminderShown] = useState(false);

  const applyRows = useCallback(
    (list) => {
      const sorted = sortBookings(withDemoRentBookings(list || [], { brandLabel }));
      setRows(sorted);
      setSelectedId((prev) => {
        const want = String(highlightBookingId || '').trim();
        if (want && sorted.some((b) => b.id === want)) return want;
        if (prev && sorted.some((b) => b.id === prev)) return prev;
        return sorted[0]?.id || '';
      });
    },
    [brandLabel, highlightBookingId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchMyRentalBookings();
      applyRows(list);
    } catch (err) {
      // Soft demo: inject local booking so Check-in is visible without JWT.
      if (isSoftNativeRentDemoToken() || isNativeRentDemo()) {
        applyRows([]);
      } else {
        toast.error(err.message || 'Αποτυχία φόρτωσης κρατήσεων');
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  }, [applyRows]);

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

  useEffect(() => {
    if (reminderShown) return;
    try {
      const enabled = localStorage.getItem('rent_reminders_enabled_v1') === '1';
      if (!enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const upcoming = rows.find((b) => {
        if (b.rental_status !== 'CONFIRMED') return false;
        const start = new Date(b.start_time).getTime();
        if (!Number.isFinite(start)) return false;
        const diffH = (start - Date.now()) / (1000 * 60 * 60);
        return diffH >= 0 && diffH <= 24;
      });
      if (!upcoming) return;
      new Notification('Υπενθύμιση παραλαβής οχήματος', {
        body: `${upcoming.vehicle_model || 'Όχημα'} · ${formatWhen(upcoming.start_time)}`,
      });
      setReminderShown(true);
    } catch {
      /* ignore */
    }
  }, [rows, reminderShown]);

  const cancelBooking = async (booking) => {
    if (!booking?.id) return;
    if (!window.confirm('Να ακυρωθεί αυτή η κράτηση;')) return;
    setBusyId(booking.id);
    try {
      // Soft demo pass: clear local card + cancel office Δοκιμαστικός / RN-DEMO01.
      if (isDemoRentBookingId(booking.id)) {
        cancelDemoRentBooking(booking.id, { brandLabel });
        try {
          await demoOfficeRentalCancel();
        } catch {
          /* office sync best-effort — local cancel already applied */
        }
        toast.success('Η κράτηση ακυρώθηκε');
        applyRows([]);
        return;
      }
      if (!isFreeCancelEligible(booking)) {
        toast.error(cancelBlockedMessage(booking));
        return;
      }
      await cancelCustomerRentalBooking(booking.id);
      toast.success('Η κράτηση ακυρώθηκε');
      await load();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία ακύρωσης');
    } finally {
      setBusyId('');
    }
  };

  // While loading with no rows yet, keep quiet (seed/API will fill).
  if (loading && !rows.length) {
    return null;
  }

  const countLabel = rows.length
    ? `${rows.length} ${rows.length === 1 ? 'κάρτα οχήματος' : 'κάρτες οχήματος'}`
    : 'Κάρτες οχήματος στο Wallet';

  return (
    <section className="wallet-panel wallet-panel--rent-passes">
      <div className="wallet-panel-head rent-wallet-panel-head">
        <span className="wallet-panel-head-icon is-mint" aria-hidden>
          <span className="material-symbols-outlined">directions_car</span>
        </span>
        <div>
          <h2>Οι ενοικιάσεις μου</h2>
          <p>{loading ? 'Φόρτωση…' : countLabel}</p>
        </div>
      </div>
      <div className="rent-wallet">
        <RentalWalletPass
          booking={featured}
          brandLabel={brandLabel}
          passengerName={passengerName}
          onBookVehicle={onBookVehicle}
          onCancel={featured ? cancelBooking : undefined}
          onCheckIn={featured ? (b) => setCheckinBooking(b) : undefined}
          cancelling={featured ? busyId === featured?.id : false}
        />

        {others.length ? (
          <section className="rent-wallet-more" aria-label="Άλλες ενοικιάσεις">
            <div className="rent-wallet-more-head">
              <h3 className="rent-wallet-more-title">Άλλες κρατήσεις</h3>
              <span className="rent-wallet-more-count">{others.length}</span>
            </div>
            <div className="rent-wallet-mini-list">
              {others.map((b) => {
                const st = b.rental_status || '';
                const stLabel = STATUS_LABEL[st] || st;
                const ready = Boolean(b.online_checkin_ready);
                return (
                  <div key={b.id} className="rent-wallet-mini">
                    <button
                      type="button"
                      className="rent-wallet-mini-btn"
                      onClick={() => setSelectedId(b.id)}
                    >
                      <span className="rent-wallet-mini-icon" aria-hidden>
                        <span className="material-symbols-outlined">directions_car</span>
                      </span>
                      <span className="rent-wallet-mini-body">
                        <span className="rent-wallet-mini-top">
                          <strong>{b.vehicle_model || 'Όχημα'}</strong>
                          <span
                            className={`rent-wallet-mini-chip ${
                              st === 'CONFIRMED' || st === 'ACTIVE'
                                ? 'is-ok'
                                : st === 'CANCELLED'
                                  ? 'is-muted'
                                  : 'is-warn'
                            }`}
                          >
                            {stLabel}
                          </span>
                        </span>
                        <span className="rent-wallet-mini-plate">
                          {b.vehicle_plate || '—'}
                          {ready ? ' · Check-in έτοιμο' : ''}
                        </span>
                        <span className="rent-wallet-mini-when">
                          {formatWhen(b.start_time)} → {formatWhen(b.end_time)}
                        </span>
                        <span className="rent-wallet-mini-meta">
                          {b.pickup_location || 'Γραφείο'} · €
                          {Number(b.total_cost || 0).toFixed(2)}
                        </span>
                      </span>
                      <span className="material-symbols-outlined rent-wallet-mini-chevron" aria-hidden>
                        chevron_right
                      </span>
                    </button>
                    {canCheckIn(b) ? (
                      <button
                        type="button"
                        className="wallet-btn wallet-btn-primary rent-wallet-card-checkin"
                        onClick={() => setCheckinBooking(b)}
                      >
                        Check-in τώρα
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
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
