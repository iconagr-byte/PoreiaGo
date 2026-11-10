import { Link } from 'react-router-dom';
import { isPaid } from '../../lib/bookingDisplay.js';

/**
 * Περισσότερα — trip-related info placeholder (former Εγώ tab slot).
 * Profile / logout live in the header person menu.
 */
export default function WalletMorePanel({
  bookings = [],
  brandLabel = '',
  nativeWallet = false,
  onOpenBookings,
  onOpenPass,
  onBookTrip,
}) {
  const upcoming = bookings.filter((b) => {
    const st = String(b.status || '').toLowerCase();
    return !st.includes('cancel') && !st.includes('ακυρ');
  }).slice(0, 3);

  return (
    <div className="wallet-stack">
      <section className="wallet-panel">
        <div className="wallet-panel-head">
          <span className="wallet-panel-head-icon" aria-hidden>
            <span className="material-symbols-outlined">travel_explore</span>
          </span>
          <div>
            <h2>Περισσότερα</h2>
            <p>
              Πληροφορίες για τις εκδρομές σας
              {brandLabel ? ` · ${brandLabel}` : ''}. Σύντομα οδηγίες ταξιδιού και χρήσιμα tips.
            </p>
          </div>
        </div>
      </section>

      <section className="wallet-panel">
        <div className="wallet-panel-head">
          <span className="wallet-panel-head-icon is-mint" aria-hidden>
            <span className="material-symbols-outlined">confirmation_number</span>
          </span>
          <div>
            <h2>Οι εκδρομές σας</h2>
            <p>
              {upcoming.length
                ? `${upcoming.length} ενεργές κράτηση${upcoming.length === 1 ? '' : 'εις'}`
                : 'Δεν έχετε ενεργές κράτηση ακόμα'}
            </p>
          </div>
        </div>
        {upcoming.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '0.5rem 0 0.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              alignItems: 'center',
            }}
          >
            {onBookTrip ? (
              <button type="button" className="wallet-btn wallet-btn-primary" onClick={onBookTrip}>
                Κράτηση εκδρομής
              </button>
            ) : (
              <Link to={nativeWallet ? '/wallet' : '/'} className="wallet-btn wallet-btn-primary">
                Κράτηση εκδρομής
              </Link>
            )}
            {nativeWallet ? (
              <Link to="/my-booking" className="wallet-btn wallet-btn-ghost">
                Εύρεση κράτησης
              </Link>
            ) : null}
          </div>
        ) : (
          <ul className="wallet-more-trip-list">
            {upcoming.map((b) => (
              <li key={b.id} className="wallet-more-trip-row">
                <div>
                  <p className="wallet-more-trip-title">{b.tripTitle || 'Εκδρομή'}</p>
                  <p className="wallet-more-trip-meta">
                    {b.date || '—'}
                    {b.time ? ` · ${b.time}` : ''}
                    {b.seat ? ` · θέση ${b.seat}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className="wallet-btn wallet-btn-ghost"
                  onClick={() => (isPaid(b) ? onOpenPass?.(b) : onOpenBookings?.())}
                >
                  {isPaid(b) ? 'Εισιτήριο' : 'Κράτηση'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {bookings.length > 0 ? (
          <button
            type="button"
            className="wallet-btn wallet-btn-ghost wallet-btn-block"
            style={{ marginTop: '0.75rem' }}
            onClick={() => onOpenBookings?.()}
          >
            Όλες οι κρατήσεις
          </button>
        ) : null}
      </section>

      <section className="wallet-panel">
        <div className="wallet-panel-head">
          <span className="wallet-panel-head-icon is-sunset" aria-hidden>
            <span className="material-symbols-outlined">info</span>
          </span>
          <div>
            <h2>Πριν την αναχώρηση</h2>
            <p>Σύντομες υπενθυμίσεις για την επιβίβαση.</p>
          </div>
        </div>
        <ul className="wallet-more-tips">
          <li>
            <span className="material-symbols-outlined" aria-hidden>
              qr_code_2
            </span>
            Έχετε έτοιμο το QR εισιτήριο στην καρτέλα «Εισιτήριο».
          </li>
          <li>
            <span className="material-symbols-outlined" aria-hidden>
              schedule
            </span>
            Φτάστε στο σημείο επιβίβασης λίγο νωρίτερα από την ώρα αναχώρησης.
          </li>
          <li>
            <span className="material-symbols-outlined" aria-hidden>
              notifications_active
            </span>
            Ενεργοποιήστε ειδοποιήσεις από το κουδούνι επάνω δεξιά για MARK και ενημερώσεις.
          </li>
        </ul>
      </section>

      <section className="wallet-panel wallet-panel--muted">
        <p className="wallet-more-placeholder">
          Εδώ θα προστεθούν σύντομα περισσότερες πληροφορίες ταξιδιού (σημεία συνάντησης, καιρός,
          οδηγίες προορισμού).
        </p>
      </section>
    </div>
  );
}
