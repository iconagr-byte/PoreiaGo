/**
 * Rent Wallet hero pass — vehicle rental booking (separate from bus My Wallet).
 */
import { QRCode } from 'react-qr-code';

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
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatRange(start, end) {
  return `${formatWhen(start)} → ${formatWhen(end)}`;
}

function statusClass(status) {
  if (status === 'ACTIVE' || status === 'CONFIRMED') return 'is-ok';
  if (status === 'CANCELLED') return 'is-muted';
  return 'is-warn';
}

export default function RentalWalletPass({
  booking,
  brandLabel = 'Rent Wallet',
  passengerName = '',
  onBookVehicle,
  onCancel,
  cancelling = false,
}) {
  if (!booking) {
    return (
      <section className="wallet-pass-empty rent-wallet-empty" aria-label="Rent Wallet">
        <div className="wallet-pass-empty-inner">
          <span className="material-symbols-outlined wallet-pass-empty-icon" aria-hidden>
            directions_car
          </span>
          <h2 className="wallet-pass-empty-title">Δεν έχετε ακόμα ενοικίαση</h2>
          <p className="wallet-pass-empty-copy">
            Κλείστε όχημα από την εφαρμογή ενοικίασης — η κράτηση εμφανίζεται εδώ στο Rent Wallet,
            χωριστά από τα εισιτήρια λεωφορείου.
          </p>
          <button type="button" className="wallet-pass-cta" onClick={onBookVehicle}>
            Βρες όχημα
            <span className="material-symbols-outlined" aria-hidden>
              arrow_forward
            </span>
          </button>
        </div>
      </section>
    );
  }

  const status = booking.rental_status || 'CONFIRMED';
  const label = STATUS_LABEL[status] || status;
  const code = booking.id || '—';
  const pickup = booking.pickup_location || 'Γραφείο';
  const dropoff = booking.dropoff_location || pickup;
  const qrValue = `RENT:${code}`;

  return (
    <section className="wallet-pass rent-wallet-pass" aria-label="Κάρτα ενοικίασης">
      <div className="wallet-pass-hero rent-wallet-hero">
        <div className="wallet-pass-hero-shade" aria-hidden />
        <div className="wallet-pass-hero-copy">
          <p className="wallet-pass-brand">{brandLabel}</p>
          <h1 className="wallet-pass-title">
            {booking.vehicle_model || 'Όχημα'}
            {booking.vehicle_plate ? ` · ${booking.vehicle_plate}` : ''}
          </h1>
          <p className="wallet-pass-when">{formatRange(booking.start_time, booking.end_time)}</p>
        </div>
      </div>

      <div className="wallet-pass-card wallet-pass-card-enter">
        <div className="wallet-pass-card-top">
          <div className="min-w-0">
            <p className="wallet-pass-kicker">Πελάτης</p>
            <p className="wallet-pass-passenger truncate">{passengerName || '—'}</p>
          </div>
          <span className={`wallet-pass-status ${statusClass(status)}`}>{label}</span>
        </div>

        <div className="wallet-pass-meta">
          <div>
            <p className="wallet-pass-kicker">Παραλαβή</p>
            <p className="wallet-pass-meta-value">{pickup}</p>
          </div>
          <div>
            <p className="wallet-pass-kicker">Κωδικός</p>
            <p className="wallet-pass-meta-value wallet-pass-mono">{code}</p>
          </div>
          <div>
            <p className="wallet-pass-kicker">Ποσό</p>
            <p className="wallet-pass-meta-value">€{Number(booking.total_cost || 0).toFixed(2)}</p>
          </div>
        </div>

        {booking.payment_status || booking.payment_label ? (
          <div className="rent-wallet-pay">
            <span className="material-symbols-outlined" aria-hidden>
              payments
            </span>
            <span>
              {booking.payment_label || booking.payment_status}
              {Number(booking.balance_due) > 0
                ? ` · υπόλοιπο €${Number(booking.balance_due).toFixed(2)}`
                : ''}
            </span>
          </div>
        ) : null}

        <div className="rent-wallet-route">
          <span className="material-symbols-outlined" aria-hidden>
            trip_origin
          </span>
          <span>
            {pickup}
            {dropoff !== pickup ? ` → ${dropoff}` : ''}
          </span>
          <span className="rent-wallet-mode">
            {booking.driver_mode === 'WITH_DRIVER' ? 'Με οδηγό' : 'Self-drive'}
          </span>
        </div>

        <div className="wallet-pass-perforation" aria-hidden>
          <span />
          <span />
        </div>

        <div className="wallet-pass-qr-wrap is-live">
          <div className="bg-white p-3 rounded-2xl wallet-pass-qr">
            <QRCode value={qrValue} size={168} bgColor="#ffffff" fgColor="#0b3d4a" level="M" />
          </div>
          <p className="wallet-pass-qr-hint">Δείξτε το QR στο γραφείο κατά την παραλαβή</p>
        </div>

        <div className="wallet-pass-actions">
          {status === 'CONFIRMED' && onCancel ? (
            <button
              type="button"
              className="wallet-btn wallet-btn-danger wallet-btn-block"
              disabled={cancelling}
              onClick={() => onCancel(booking)}
            >
              {cancelling ? 'Ακύρωση…' : 'Ακύρωση κράτησης'}
            </button>
          ) : null}
          <button type="button" className="wallet-pass-cta" onClick={onBookVehicle}>
            Νέα κράτηση
          </button>
        </div>
      </div>
    </section>
  );
}
