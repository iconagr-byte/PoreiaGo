/**
 * Rent booking detail — Apple Wallet «back of pass» (like WalletTicketDetail for buses).
 * Info from pass → details + print/PDF + email + delete at bottom.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import { QRCode } from 'react-qr-code';
import {
  emailCustomerRentalBooking,
  openCustomerRentalContract,
} from '../../services/customerRentalApi.js';
import { isDemoRentBookingId } from '../../lib/rental/demoRentBooking.js';

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

function statusClass(status) {
  if (status === 'ACTIVE' || status === 'CONFIRMED') return 'is-ok';
  if (status === 'CANCELLED') return 'wallet-pass-status--expired';
  if (status === 'COMPLETED') return 'is-done';
  return 'is-warn';
}

export default function RentalWalletDetail({
  booking,
  brandLabel = 'Rent Wallet',
  passengerName = '',
  onBack,
  onRemovePass,
}) {
  const [emailSending, setEmailSending] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [removing, setRemoving] = useState(false);

  if (!booking) return null;

  const status = booking.rental_status || 'CONFIRMED';
  const label = STATUS_LABEL[status] || status;
  const code = booking.reference_code || booking.id || '—';
  const pickup = booking.pickup_location || 'Γραφείο';
  const dropoff = booking.dropoff_location || pickup;
  const qrValue = `RENT:${booking.id || code}`;
  const paid =
    String(booking.payment_status || '')
      .toUpperCase()
      .includes('PAID') || Number(booking.balance_due || 0) <= 0;
  const selfDrive = booking.driver_mode !== 'WITH_DRIVER';
  const name =
    passengerName ||
    booking.client_name ||
    booking.customer_name ||
    booking.customerName ||
    '—';
  const email = String(booking.client_email || booking.email || '').trim();
  const phone = String(booking.client_phone || booking.phone || '').trim();
  const cancelled = status === 'CANCELLED';

  const handlePrint = async () => {
    if (printing) return;
    setPrinting(true);
    try {
      if (isDemoRentBookingId(booking.id)) {
        window.print();
        toast.success('Άνοιξε η εκτύπωση / PDF');
        return;
      }
      await openCustomerRentalContract(booking.id);
      toast.success('Άνοιξε η σύμβαση για εκτύπωση / PDF');
    } catch (err) {
      toast.error(err?.message || 'Αποτυχία εκτύπωσης');
    } finally {
      setPrinting(false);
    }
  };

  const handleEmail = async () => {
    if (emailSending) return;
    if (!email && !isDemoRentBookingId(booking.id)) {
      toast.error('Δεν υπάρχει email σε αυτή την κράτηση');
      return;
    }
    setEmailSending(true);
    try {
      if (isDemoRentBookingId(booking.id)) {
        const subject = encodeURIComponent(`Κράτηση ${code} — ${brandLabel}`);
        const body = encodeURIComponent(
          [
            `Κράτηση: ${code}`,
            `Όχημα: ${booking.vehicle_model || '—'}`,
            `Πινακίδα: ${booking.vehicle_plate || '—'}`,
            `Παραλαβή: ${formatWhen(booking.start_time)} · ${pickup}`,
            `Επιστροφή: ${formatWhen(booking.end_time)} · ${dropoff}`,
            `Σύνολο: €${Number(booking.total_cost || 0).toFixed(2)}`,
          ].join('\n'),
        );
        window.location.href = `mailto:${email || ''}?subject=${subject}&body=${body}`;
        toast.success('Άνοιξε το email');
        return;
      }
      const result = await emailCustomerRentalBooking(booking.id);
      toast.success(
        result?.email
          ? `Στάλθηκε στο ${result.email}`
          : 'Η αποστολή καταγράφηκε',
      );
    } catch (err) {
      toast.error(err?.message || 'Αποτυχία αποστολής');
    } finally {
      setEmailSending(false);
    }
  };

  const handleRemove = async () => {
    if (!onRemovePass || removing) return;
    const ok = window.confirm(
      'Διαγραφή κράτησης οριστικά;\n\nΘα φύγει από το Wallet και από τις κρατήσεις του γραφείου (όλες οι συσκευές). Δεν αναιρείται.',
    );
    if (!ok) return;
    setRemoving(true);
    try {
      await onRemovePass(booking);
      toast.success('Η κράτηση διαγράφηκε από παντού');
    } catch (err) {
      toast.error(err?.message || 'Αποτυχία διαγραφής κράτησης');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="wallet-ticket rent-wallet-ticket">
      <button type="button" className="wallet-ticket-back" onClick={onBack}>
        <span className="material-symbols-outlined" aria-hidden>
          arrow_back
        </span>
        Πίσω στην κράτηση
      </button>

      <section
        className={`wallet-pass rent-wallet-pass${cancelled ? ' wallet-pass--expired' : ''}`}
        aria-label="Λεπτομέρειες κράτησης ενοικίασης"
      >
        <div className="wallet-pass-hero rent-wallet-hero">
          <div className="wallet-pass-hero-shade rent-wallet-hero-shade" aria-hidden />
          <div className="wallet-pass-hero-copy rent-wallet-hero-copy">
            <p className="wallet-pass-brand">{brandLabel}</p>
            <h1 className="wallet-pass-title">{booking.vehicle_model || 'Όχημα'}</h1>
            <p className="wallet-pass-when">
              {formatWhen(booking.start_time)}
              {booking.vehicle_plate ? ` · ${booking.vehicle_plate}` : ''}
            </p>
          </div>
        </div>

        <div className={`wallet-pass-card wallet-pass-card-enter rent-wallet-card${cancelled ? ' is-expired' : ''}`}>
          <div className="wallet-pass-card-top">
            <div className="min-w-0">
              <p className="wallet-pass-kicker">Πελάτης</p>
              <p className="wallet-pass-passenger truncate">{name}</p>
            </div>
            <span className={`wallet-pass-status ${statusClass(status)}`}>{label}</span>
          </div>

          <div className="wallet-pass-meta">
            <div>
              <p className="wallet-pass-kicker">Κωδικός</p>
              <p className="wallet-pass-meta-value wallet-pass-mono">{code}</p>
            </div>
            <div>
              <p className="wallet-pass-kicker">Οδήγηση</p>
              <p className="wallet-pass-meta-value">{selfDrive ? 'Self-drive' : 'Με οδηγό'}</p>
            </div>
            <div>
              <p className="wallet-pass-kicker">Σύνολο</p>
              <p className="wallet-pass-meta-value">€{Number(booking.total_cost || 0).toFixed(2)}</p>
            </div>
          </div>

          <div className="wallet-pass-perforation" aria-hidden>
            <span />
            <span />
          </div>

          <div className={`wallet-pass-qr-wrap rent-wallet-qr${paid && !cancelled ? ' is-live' : ''}`}>
            {cancelled ? (
              <div className="wallet-pass-expired-panel" role="status">
                <span className="material-symbols-outlined" aria-hidden>
                  event_busy
                </span>
                <p>Η κράτηση ακυρώθηκε</p>
              </div>
            ) : (
              <>
                <div className="rent-wallet-qr-frame">
                  <QRCode value={qrValue} size={152} bgColor="#ffffff" fgColor="#0b3d4a" level="M" />
                </div>
                <p className="wallet-pass-qr-hint">Δείξε το QR στο γραφείο κατά την παραλαβή</p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="wallet-ticket-panel">
        <h2>Παραλαβή & επιστροφή</h2>
        <dl className="wallet-ticket-dl">
          <div>
            <dt>Παραλαβή</dt>
            <dd>
              {formatWhen(booking.start_time)}
              <br />
              {pickup}
            </dd>
          </div>
          <div>
            <dt>Επιστροφή</dt>
            <dd>
              {formatWhen(booking.end_time)}
              <br />
              {dropoff}
            </dd>
          </div>
          {booking.vehicle_category ? (
            <div>
              <dt>Κατηγορία</dt>
              <dd>{booking.vehicle_category}</dd>
            </div>
          ) : null}
          {booking.online_checkin_ready ? (
            <div>
              <dt>Check-in</dt>
              <dd>Επιβεβαιωμένο</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="wallet-ticket-panel">
        <h2>Πληρωμή</h2>
        <dl className="wallet-ticket-dl">
          <div>
            <dt>Κατάσταση</dt>
            <dd>{paid ? 'Εξοφλήθηκε' : 'Εκκρεμεί'}</dd>
          </div>
          <div>
            <dt>Τρόπος</dt>
            <dd>{booking.payment_method || booking.payment_label || '—'}</dd>
          </div>
          {Number(booking.amount_paid) > 0 ? (
            <div>
              <dt>Πληρώθηκε</dt>
              <dd>€{Number(booking.amount_paid || 0).toFixed(2)}</dd>
            </div>
          ) : null}
          {Number(booking.balance_due) > 0 ? (
            <div>
              <dt>Υπόλοιπο</dt>
              <dd className="text-amber-700">€{Number(booking.balance_due).toFixed(2)}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="wallet-ticket-panel">
        <h2>Στοιχεία επικοινωνίας</h2>
        <dl className="wallet-ticket-dl">
          <div>
            <dt>Email</dt>
            <dd>{email || '—'}</dd>
          </div>
          <div>
            <dt>Τηλέφωνο</dt>
            <dd>{phone || '—'}</dd>
          </div>
        </dl>
      </section>

      <div className="wallet-ticket-actions">
        <button
          type="button"
          className="wallet-pass-cta"
          onClick={handlePrint}
          disabled={printing}
        >
          <span className="material-symbols-outlined" aria-hidden>
            {printing ? 'hourglass_empty' : 'print'}
          </span>
          {printing ? 'Άνοιγμα…' : 'Εκτύπωση / PDF'}
        </button>
        <button
          type="button"
          className="wallet-pass-secondary wallet-ticket-email"
          onClick={handleEmail}
          disabled={emailSending}
        >
          <span className="material-symbols-outlined" aria-hidden>
            {emailSending ? 'hourglass_empty' : 'mail'}
          </span>
          {emailSending ? 'Αποστολή…' : 'Αποστολή στο email'}
        </button>
      </div>

      {onRemovePass ? (
        <section className="wallet-ticket-remove" aria-label="Διαγραφή κράτησης">
          <button
            type="button"
            className="wallet-ticket-remove-btn"
            onClick={handleRemove}
            disabled={removing}
          >
            {removing ? 'Αφαίρεση…' : 'Διαγραφή κράτησης'}
          </button>
          <p className="wallet-ticket-remove-hint">
            Όπως στο Apple Wallet — φεύγει από το Wallet και από τις κρατήσεις του γραφείου.
            Δεν αναιρείται.
          </p>
        </section>
      ) : null}
    </div>
  );
}
