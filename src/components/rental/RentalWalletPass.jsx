/**
 * Rent Wallet hero pass — vehicle rental booking (Apple-clean, separate from bus).
 */
import { QRCode } from 'react-qr-code';

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

function statusClass(status) {
  if (status === 'ACTIVE' || status === 'CONFIRMED') return 'is-ok';
  if (status === 'CANCELLED') return 'is-muted';
  if (status === 'COMPLETED') return 'is-done';
  return 'is-warn';
}

function nightsBetween(start, end) {
  try {
    const a = new Date(start).getTime();
    const b = new Date(end).getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
    return Math.max(1, Math.round((b - a) / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
}

export default function RentalWalletPass({
  booking,
  brandLabel = 'Rent Wallet',
  passengerName = '',
  onBookVehicle,
  onCancel,
  onDelete,
  onCheckIn,
  cancelling = false,
  deleting = false,
}) {
  if (!booking) {
    return (
      <section className="wallet-pass-empty rent-wallet-empty" aria-label="Rent Wallet">
        <div className="wallet-pass-empty-inner rent-wallet-empty-inner">
          <span className="rent-wallet-empty-orb" aria-hidden>
            <span className="material-symbols-outlined">directions_car</span>
          </span>
          <h2 className="wallet-pass-empty-title">Καμία ενοικίαση ακόμη</h2>
          <p className="wallet-pass-empty-copy">
            Κλείσε όχημα από το στόλο — η κάρτα παραλαβής εμφανίζεται εδώ, δίπλα στα εισιτήρια.
          </p>
          <button type="button" className="wallet-pass-cta rent-wallet-empty-cta" onClick={onBookVehicle}>
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
  const code = booking.reference_code || booking.id || '—';
  const pickup = booking.pickup_location || 'Γραφείο';
  const dropoff = booking.dropoff_location || pickup;
  const qrValue = `RENT:${booking.id || code}`;
  const nights = nightsBetween(booking.start_time, booking.end_time);
  const paid =
    String(booking.payment_status || '')
      .toUpperCase()
      .includes('PAID') || Number(booking.balance_due || 0) <= 0;
  const selfDrive = booking.driver_mode !== 'WITH_DRIVER';
  const checkinReady = Boolean(booking.online_checkin_ready);

  return (
    <section className="wallet-pass rent-wallet-pass" aria-label="Κάρτα ενοικίασης">
      <div className="wallet-pass-hero rent-wallet-hero">
        <div className="wallet-pass-hero-shade rent-wallet-hero-shade" aria-hidden />
        <div className="rent-wallet-hero-glow" aria-hidden />
        <div className="wallet-pass-hero-copy rent-wallet-hero-copy">
          <div className="rent-wallet-hero-top">
            <p className="wallet-pass-brand">{brandLabel}</p>
            <span className={`rent-wallet-hero-chip ${statusClass(status)}`}>{label}</span>
          </div>
          <h1 className="wallet-pass-title rent-wallet-hero-title">
            {booking.vehicle_model || 'Όχημα'}
          </h1>
          {booking.vehicle_plate ? (
            <p className="rent-wallet-hero-plate">
              <span className="material-symbols-outlined" aria-hidden>
                directions_car
              </span>
              {booking.vehicle_plate}
            </p>
          ) : null}
          {nights > 0 ? (
            <p className="rent-wallet-hero-nights">
              {nights} {nights === 1 ? 'ημέρα' : 'ημέρες'} ενοικίασης
            </p>
          ) : null}
        </div>
      </div>

      <div className="wallet-pass-card wallet-pass-card-enter rent-wallet-card">
        <div className="rent-wallet-legs" aria-label="Παραλαβή και επιστροφή">
          <div className="rent-wallet-leg">
            <em>Παραλαβή</em>
            <strong>{formatDay(booking.start_time)}</strong>
            <span>{formatClock(booking.start_time)}</span>
          </div>
          <span className="rent-wallet-leg-sep" aria-hidden>
            <span className="rent-wallet-leg-line" />
            <span className="material-symbols-outlined">arrow_forward</span>
            <span className="rent-wallet-leg-line" />
          </span>
          <div className="rent-wallet-leg rent-wallet-leg--end">
            <em>Επιστροφή</em>
            <strong>{formatDay(booking.end_time)}</strong>
            <span>{formatClock(booking.end_time)}</span>
          </div>
        </div>

        <div className="rent-wallet-card-top">
          <div className="min-w-0">
            <p className="wallet-pass-kicker">Πελάτης</p>
            <p className="wallet-pass-passenger truncate">{passengerName || '—'}</p>
          </div>
          <div className="rent-wallet-status-stack">
            {checkinReady ? (
              <span className="wallet-pass-status is-ok rent-wallet-checkin-chip">
                <span className="material-symbols-outlined" aria-hidden>
                  task_alt
                </span>
                Check-in
              </span>
            ) : null}
            <span className={`rent-wallet-mode-pill ${selfDrive ? 'is-self' : 'is-driver'}`}>
              {selfDrive ? 'Self-drive' : 'Με οδηγό'}
            </span>
          </div>
        </div>

        <div className="rent-wallet-facts">
          <div className="rent-wallet-fact">
            <span className="material-symbols-outlined" aria-hidden>
              location_on
            </span>
            <div>
              <p className="wallet-pass-kicker">Παραλαβή</p>
              <p className="wallet-pass-meta-value">{pickup}</p>
              {dropoff !== pickup ? (
                <p className="rent-wallet-fact-sub">Επιστροφή · {dropoff}</p>
              ) : null}
            </div>
          </div>
          <div className="rent-wallet-fact">
            <span className="material-symbols-outlined" aria-hidden>
              confirmation_number
            </span>
            <div>
              <p className="wallet-pass-kicker">Κωδικός</p>
              <p className="wallet-pass-meta-value wallet-pass-mono">{code}</p>
            </div>
          </div>
          <div className="rent-wallet-fact">
            <span className="material-symbols-outlined" aria-hidden>
              payments
            </span>
            <div>
              <p className="wallet-pass-kicker">Σύνολο</p>
              <p className="wallet-pass-meta-value">
                €{Number(booking.total_cost || 0).toFixed(2)}
                <span className={`rent-wallet-pay-tag ${paid ? 'is-paid' : 'is-due'}`}>
                  {paid ? 'Πληρωμένο' : 'Υπόλοιπο'}
                </span>
              </p>
              {Number(booking.balance_due) > 0 ? (
                <p className="rent-wallet-fact-sub">
                  Υπόλοιπο €{Number(booking.balance_due).toFixed(2)}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="wallet-pass-perforation rent-wallet-perf" aria-hidden>
          <span />
          <span />
        </div>

        <div className="wallet-pass-qr-wrap is-live rent-wallet-qr">
          <div className="rent-wallet-qr-frame">
            <QRCode value={qrValue} size={152} bgColor="#ffffff" fgColor="#0b3d4a" level="M" />
          </div>
          <p className="wallet-pass-qr-hint">Δείξε το QR στο γραφείο κατά την παραλαβή</p>
        </div>

        <div className="wallet-pass-actions rent-wallet-actions">
          {checkinReady ? (
            <p className="rent-wallet-checkin-ready" role="status">
              <span className="material-symbols-outlined" aria-hidden>
                task_alt
              </span>
              Επιβεβαιωμένο check-in — το γραφείο το βλέπει
            </p>
          ) : null}
          {(status === 'CONFIRMED' || status === 'RESERVED' || status === 'ACTIVE') &&
          onCheckIn ? (
            <button
              type="button"
              className={`wallet-btn wallet-btn-block ${
                checkinReady
                  ? 'wallet-btn-ghost rent-wallet-checkin-done-btn'
                  : 'wallet-btn-primary rent-wallet-checkin-cta'
              }`}
              onClick={() => onCheckIn(booking)}
            >
              <span className="material-symbols-outlined" aria-hidden>
                {checkinReady ? 'verified' : 'bolt'}
              </span>
              {checkinReady ? 'Επιβεβαιωμένο check-in' : 'Check-in τώρα'}
            </button>
          ) : null}
          <div className="rent-wallet-action-row">
            <button type="button" className="rent-wallet-link-btn" onClick={onBookVehicle}>
              <span className="material-symbols-outlined" aria-hidden>
                add_circle
              </span>
              Νέα κράτηση
            </button>
            {(status === 'CONFIRMED' || status === 'RESERVED') && onCancel ? (
              <button
                type="button"
                className="rent-wallet-link-btn is-danger"
                disabled={cancelling || deleting}
                onClick={() => onCancel(booking)}
              >
                <span className="material-symbols-outlined" aria-hidden>
                  event_busy
                </span>
                {cancelling ? 'Ακύρωση…' : 'Ακύρωση'}
              </button>
            ) : null}
          </div>
        </div>

        {onDelete ? (
          <section className="wallet-ticket-remove rent-wallet-remove" aria-label="Διαγραφή κράτησης">
            <button
              type="button"
              className="wallet-ticket-remove-btn"
              onClick={() => onDelete(booking)}
              disabled={deleting || cancelling}
            >
              {deleting ? 'Αφαίρεση…' : 'Διαγραφή κράτησης'}
            </button>
            <p className="wallet-ticket-remove-hint">
              Όπως στο Apple Wallet — φεύγει από το Wallet και από τις κρατήσεις του γραφείου.
              Δεν αναιρείται.
            </p>
          </section>
        ) : null}
      </div>
    </section>
  );
}
