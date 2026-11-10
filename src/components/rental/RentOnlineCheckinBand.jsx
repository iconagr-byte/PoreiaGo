import { useState } from 'react';
import {
  guestRentalCheckIn,
  guestRentalLookup,
} from '../../services/customerRentalApi.js';

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

/**
 * Online check-in band for guest /rent — surname + RN code.
 * Distinct from Hertz: split card, teal mist, vertical rhythm.
 */
export default function RentOnlineCheckinBand({ brandLabel = 'Γραφείο' } = {}) {
  const [surname, setSurname] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState(null);
  const [done, setDone] = useState(false);

  const onLookup = async (e) => {
    e?.preventDefault?.();
    setError('');
    setDone(false);
    setBooking(null);
    if (surname.trim().length < 2 || code.trim().length < 4) {
      setError('Συμπλήρωσε επώνυμο και κωδικό κράτησης (π.χ. RN-XXXXXXXX).');
      return;
    }
    setLoading(true);
    try {
      const row = await guestRentalLookup({ surname, referenceCode: code });
      setBooking(row);
      if (row?.online_checkin_ready) setDone(true);
    } catch (err) {
      setError(err?.message || 'Δεν βρέθηκε η κράτηση.');
    } finally {
      setLoading(false);
    }
  };

  const onCheckIn = async () => {
    setError('');
    setCheckingIn(true);
    try {
      const row = await guestRentalCheckIn({ surname, referenceCode: code });
      setBooking(row);
      setDone(true);
    } catch (err) {
      setError(err?.message || 'Αποτυχία check-in.');
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <section id="rent-online-checkin" className="rent-checkin" aria-label="Online check-in">
      <div className="rent-checkin-shell">
        <div className="rent-checkin-intro">
          <p className="rent-checkin-eyebrow">Online check-in</p>
          <h2 className="rent-checkin-title">Ετοιμάσου πριν την παραλαβή</h2>
          <p className="rent-checkin-copy">
            Βρες την κράτησή σου στο {brandLabel} με επώνυμο και κωδικό — χωρίς ουρά στο γραφείο.
          </p>
          <ul className="rent-checkin-tips">
            <li>Άδεια οδήγησης & ταυτότητα / διαβατήριο</li>
            <li>Κωδικός κράτησης από email επιβεβαίωσης</li>
          </ul>
        </div>

        <div className="rent-checkin-card">
          {!booking ? (
            <form className="rent-checkin-form" onSubmit={onLookup}>
              <label className="rent-checkin-field">
                <span>Επώνυμο</span>
                <div className="rent-checkin-input">
                  <span className="material-symbols-outlined" aria-hidden>
                    badge
                  </span>
                  <input
                    type="text"
                    autoComplete="family-name"
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    placeholder="π.χ. Παπαδόπουλος"
                  />
                </div>
              </label>
              <label className="rent-checkin-field">
                <span>Κωδικός κράτησης</span>
                <div className="rent-checkin-input">
                  <span className="material-symbols-outlined" aria-hidden>
                    vpn_key
                  </span>
                  <input
                    type="text"
                    autoComplete="off"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="RN-XXXXXXXX"
                  />
                </div>
              </label>
              <button type="submit" className="rent-checkin-submit" disabled={loading}>
                {loading ? 'Αναζήτηση…' : 'Συνέχεια'}
                <span className="material-symbols-outlined" aria-hidden>
                  arrow_forward
                </span>
              </button>
              <p className="rent-checkin-help">
                Δεν έχεις τον κωδικό; Έλεγξε το email επιβεβαίωσης ή ρώτα το γραφείο.
              </p>
            </form>
          ) : (
            <div className="rent-checkin-result">
              <p className="rent-checkin-result-kicker">
                {done ? 'Check-in ολοκληρώθηκε' : 'Βρέθηκε κράτηση'}
              </p>
              <h3>
                {booking.vehicle_model || 'Όχημα'}
                {booking.reference_code ? (
                  <span className="rent-checkin-code">{booking.reference_code}</span>
                ) : null}
              </h3>
              <dl className="rent-checkin-meta">
                <div>
                  <dt>Πελάτης</dt>
                  <dd>{booking.client_name_masked || '—'}</dd>
                </div>
                <div>
                  <dt>Παραλαβή</dt>
                  <dd>
                    {formatWhen(booking.start_time)}
                    {booking.pickup_location ? ` · ${booking.pickup_location}` : ''}
                  </dd>
                </div>
                <div>
                  <dt>Επιστροφή</dt>
                  <dd>
                    {formatWhen(booking.end_time)}
                    {booking.dropoff_location ? ` · ${booking.dropoff_location}` : ''}
                  </dd>
                </div>
              </dl>
              {done ? (
                <p className="rent-checkin-success">
                  Είσαι έτοιμος για παραλαβή — το γραφείο βλέπει το online check-in σου.
                </p>
              ) : (
                <button
                  type="button"
                  className="rent-checkin-submit"
                  onClick={onCheckIn}
                  disabled={checkingIn}
                >
                  {checkingIn ? 'Ολοκλήρωση…' : 'Ολοκλήρωση online check-in'}
                  <span className="material-symbols-outlined" aria-hidden>
                    task_alt
                  </span>
                </button>
              )}
              <button
                type="button"
                className="rent-checkin-reset"
                onClick={() => {
                  setBooking(null);
                  setDone(false);
                  setError('');
                }}
              >
                Άλλη κράτηση
              </button>
            </div>
          )}
          {error ? <p className="rent-checkin-error">{error}</p> : null}
        </div>
      </div>
      <p className="rent-checkin-footnote">
        Για την παραλαβή χρειάζεσαι άδεια οδήγησης και ταυτότητα ή διαβατήριο.
      </p>
    </section>
  );
}
