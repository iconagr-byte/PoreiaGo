/**
 * Rent Wallet hero pass — vehicle rental booking (separate from bus My Wallet).
 */
import { QRCode } from 'react-qr-code';
import { getRentLang, rentStatusLabel, t } from '../../lib/rental/rentI18n.js';

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(getRentLang() === 'en' ? 'en-GB' : 'el-GR', {
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

function depositLabel(status, lang) {
  if (status === 'held') return t('deposit_held', lang);
  if (status === 'released') return t('deposit_released', lang);
  if (status === 'captured') return t('deposit_captured', lang);
  if (status === 'pending_hold') return '…';
  return null;
}

function telHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

export default function RentalWalletPass({
  booking,
  brandLabel = 'Rent Wallet',
  passengerName = '',
  safetyContacts = null,
  onBookVehicle,
  onCancel,
  cancelling = false,
  onModify,
  onContract,
  onCheckIn,
  onCheckOut,
  onReview,
  reviewBusy = false,
  onSos,
  sosBusy = false,
  onShareTrip,
  shareBusy = false,
}) {
  const lang = getRentLang();

  if (!booking) {
    return (
      <section className="wallet-pass-empty rent-wallet-empty" aria-label="Rent Wallet">
        <div className="wallet-pass-empty-inner">
          <span className="material-symbols-outlined wallet-pass-empty-icon" aria-hidden>
            directions_car
          </span>
          <h2 className="wallet-pass-empty-title">{t('wallet_empty_title', lang)}</h2>
          <p className="wallet-pass-empty-copy">{t('wallet_empty_copy', lang)}</p>
          <button type="button" className="wallet-pass-cta" onClick={onBookVehicle}>
            {t('find_vehicle', lang)}
            <span className="material-symbols-outlined" aria-hidden>
              arrow_forward
            </span>
          </button>
        </div>
      </section>
    );
  }

  const status = booking.rental_status || 'CONFIRMED';
  const label = rentStatusLabel(status, lang);
  const code = booking.id || '—';
  const pickup = booking.pickup_location || 'Γραφείο';
  const dropoff = booking.dropoff_location || pickup;
  const qrValue = `RENT:${code}`;
  const dep = depositLabel(booking.damage_deposit_status, lang);
  const live = status === 'CONFIRMED' || status === 'ACTIVE';
  const roadsidePhone = safetyContacts?.roadside_phone_24_7 || '';
  const roadsideLabel = safetyContacts?.roadside_label || t('roadside_24_7', lang);
  const roadsideTel = telHref(roadsidePhone);

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
            <p className="wallet-pass-kicker">{t('customer', lang)}</p>
            <p className="wallet-pass-passenger truncate">{passengerName || '—'}</p>
          </div>
          <span className={`wallet-pass-status ${statusClass(status)}`}>{label}</span>
        </div>

        <div className="wallet-pass-meta">
          <div>
            <p className="wallet-pass-kicker">{t('pickup', lang)}</p>
            <p className="wallet-pass-meta-value">{pickup}</p>
          </div>
          <div>
            <p className="wallet-pass-kicker">{t('code', lang)}</p>
            <p className="wallet-pass-meta-value wallet-pass-mono">{code}</p>
          </div>
          <div>
            <p className="wallet-pass-kicker">{t('amount', lang)}</p>
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

        {booking.damage_deposit_eur != null && Number(booking.damage_deposit_eur) > 0 ? (
          <div className="rent-wallet-pay">
            <span className="material-symbols-outlined" aria-hidden>
              shield
            </span>
            <span>
              {t('damage_deposit', lang)} €{Number(booking.damage_deposit_eur).toFixed(2)}
              {dep ? ` · ${dep}` : ''}
            </span>
          </div>
        ) : null}

        {booking.branch_name ? (
          <p className="rent-wallet-afm">
            {t('branch', lang)}: {booking.branch_name}
          </p>
        ) : null}

        {booking.fiscal_mark ? (
          <div className="rent-wallet-fiscal">
            <span className="material-symbols-outlined" aria-hidden>
              receipt_long
            </span>
            <span>
              Απόδειξη {booking.fiscal_mark}
              {booking.fiscal_amount != null ? ` · €${Number(booking.fiscal_amount).toFixed(2)}` : ''}
            </span>
          </div>
        ) : null}

        {booking.client_afm ? (
          <p className="rent-wallet-afm">ΑΦΜ {booking.client_afm}</p>
        ) : null}

        {booking.id_verification_status && booking.id_verification_status !== 'not_required' ? (
          <div
            className={`rent-wallet-id ${
              booking.id_verification_status === 'verified'
                ? 'is-ok'
                : booking.id_verification_status === 'rejected'
                  ? 'is-bad'
                  : 'is-pending'
            }`}
          >
            <span className="material-symbols-outlined" aria-hidden>
              {booking.id_verification_status === 'verified' ? 'verified_user' : 'badge'}
            </span>
            <span>
              {booking.id_verification_status === 'verified'
                ? 'Ταυτότητα επαληθεύτηκε'
                : booking.id_verification_status === 'rejected'
                  ? 'Έγγραφα απορρίφθηκαν — επικοινωνήστε με το γραφείο'
                  : 'Έλεγχος ταυτότητας · εκκρεμεί από το γραφείο'}
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
            {booking.driver_mode === 'WITH_DRIVER' ? t('with_driver', lang) : t('self_drive', lang)}
          </span>
        </div>

        {live && roadsidePhone ? (
          <div className="rent-safety-card">
            <div className="rent-safety-card-copy">
              <p className="rent-safety-card-title">{roadsideLabel || t('roadside_24_7', lang)}</p>
              <a className="rent-safety-phone" href={roadsideTel || undefined}>
                {roadsidePhone}
              </a>
            </div>
            <div className="rent-safety-qr" aria-hidden>
              <QRCode
                value={`ROADSIDE:${roadsidePhone.replace(/\s/g, '')}`}
                size={72}
                bgColor="#ffffff"
                fgColor="#0b3d4a"
                level="M"
              />
            </div>
          </div>
        ) : null}

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
          {live && onSos ? (
            <button
              type="button"
              className="rent-sos-btn"
              disabled={sosBusy}
              onClick={() => onSos(booking)}
            >
              <span className="material-symbols-outlined" aria-hidden>
                emergency
              </span>
              {sosBusy ? t('sos_sending', lang) : t('sos', lang)}
            </button>
          ) : null}
          {live && onShareTrip ? (
            <button
              type="button"
              className="wallet-btn wallet-btn-block"
              disabled={shareBusy}
              onClick={() => onShareTrip(booking)}
            >
              {t('share_trip', lang)}
            </button>
          ) : null}
          {status === 'CONFIRMED' && onCancel ? (
            <button
              type="button"
              className="wallet-btn wallet-btn-danger wallet-btn-block"
              disabled={cancelling}
              onClick={() => onCancel(booking)}
            >
              {cancelling ? t('cancelling', lang) : t('cancel', lang)}
            </button>
          ) : null}
          {status === 'CONFIRMED' && !onCancel ? (
            <p className="rent-wallet-cancel-locked">
              Online ακύρωση κλειστή — λιγότερο από 24 ώρες πριν την παραλαβή. Επικοινωνήστε με το γραφείο.
            </p>
          ) : null}
          {onModify ? (
            <button type="button" className="wallet-btn wallet-btn-block" onClick={onModify}>
              {t('modify_dates', lang)}
            </button>
          ) : null}
          {onCheckIn ? (
            <button type="button" className="wallet-btn wallet-btn-block" onClick={onCheckIn}>
              {t('check_in', lang)}
            </button>
          ) : null}
          {onCheckOut ? (
            <button type="button" className="wallet-btn wallet-btn-block" onClick={onCheckOut}>
              {t('check_out', lang)}
            </button>
          ) : null}
          {status === 'COMPLETED' && onReview ? (
            <button
              type="button"
              className="wallet-btn wallet-btn-block"
              disabled={reviewBusy}
              onClick={() => onReview(booking)}
            >
              {t('review', lang)}
            </button>
          ) : null}
          {onContract ? (
            <button type="button" className="wallet-btn wallet-btn-block" onClick={onContract}>
              {t('contract', lang)}
            </button>
          ) : null}
          {booking.contract_accepted ? (
            <p className="rent-wallet-contract-ok">
              <span className="material-symbols-outlined" aria-hidden>
                draw
              </span>
              {t('contract_signed', lang)}
              {booking.contract_version ? ` · ${booking.contract_version}` : ''}
            </p>
          ) : null}
          <button type="button" className="wallet-pass-cta" onClick={onBookVehicle}>
            {t('new_booking', lang)}
          </button>
        </div>
      </div>
    </section>
  );
}
