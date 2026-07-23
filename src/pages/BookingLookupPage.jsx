import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import OfficeBrandMark from '../components/storefront/OfficeBrandMark.jsx';
import { lookupGuestBooking, openBookingInWallet } from '../lib/bookingLookup.js';
import '../styles/booking-lookup.css';

export default function BookingLookupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const email = e.target.email.value.trim().toLowerCase();
    const referenceCode = e.target.reference.value.trim();

    try {
      const booking = await lookupGuestBooking({ email, referenceCode });
      if (!booking) {
        toast.error('Δεν βρέθηκε κράτηση. Ελέγξτε email και κωδικό αναφοράς (π.χ. BK-…).');
        return;
      }
      openBookingInWallet(booking, email);
      toast.success('Η κράτησή σας βρέθηκε — μετάβαση στο Wallet');
      navigate('/wallet', { replace: true });
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αναζήτησης');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="booking-lookup-shell">
      <div className="booking-lookup-orb booking-lookup-orb--a" aria-hidden />
      <div className="booking-lookup-orb booking-lookup-orb--b" aria-hidden />

      <header className="booking-lookup-top">
        <Link to="/" className="booking-lookup-back">
          <span className="material-symbols-outlined" aria-hidden>
            arrow_back
          </span>
          Αρχική
        </Link>
        <OfficeBrandMark className="h-8" variant="light" />
      </header>

      <main className="booking-lookup-main">
        <section className="booking-lookup-card" aria-labelledby="booking-lookup-title">
          <div className="booking-lookup-icon" aria-hidden>
            <span className="material-symbols-outlined">confirmation_number</span>
          </div>

          <h1 id="booking-lookup-title" className="booking-lookup-title">
            Εύρεση κράτησης
          </h1>
          <p className="booking-lookup-lead">
            Βάλτε το email και τον κωδικό από το μήνυμα επιβεβαίωσης για να δείτε το εισιτήριό σας.
          </p>

          <form onSubmit={handleSubmit} className="booking-lookup-form">
            <label className="booking-lookup-field" htmlFor="email">
              <span>Email</span>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>

            <label className="booking-lookup-field" htmlFor="reference">
              <span>Κωδικός αναφοράς</span>
              <input
                id="reference"
                name="reference"
                type="text"
                required
                autoComplete="off"
                spellCheck={false}
                className="is-mono"
                placeholder="BK-XXXXXXXX"
              />
            </label>

            <button type="submit" disabled={loading} className="booking-lookup-submit">
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin" aria-hidden>
                    progress_activity
                  </span>
                  Αναζήτηση…
                </>
              ) : (
                <>
                  Εμφάνιση εισιτηρίου
                  <span className="material-symbols-outlined" aria-hidden>
                    arrow_forward
                  </span>
                </>
              )}
            </button>
          </form>

          <p className="booking-lookup-note">
            Για λόγους απορρήτου χρειάζονται και τα δύο στοιχεία — δεν εμφανίζονται όλες οι κρατήσεις του
            email.
          </p>

          <Link to="/login" className="booking-lookup-wallet">
            Σύνδεση στο My Wallet
          </Link>
        </section>
      </main>
    </div>
  );
}
