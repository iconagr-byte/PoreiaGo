import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import OfficeBrandMark from '../components/storefront/OfficeBrandMark.jsx';
import { lookupGuestBooking, openBookingInWallet } from '../lib/bookingLookup.js';

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
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="px-6 py-5 border-b border-black/[0.05] flex items-center justify-between max-w-3xl mx-auto w-full">
        <Link to="/" className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
          <span className="text-sm font-semibold">Αρχική</span>
        </Link>
        <OfficeBrandMark className="h-8" variant="light" />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-[32px] border border-black/[0.05] shadow-sm p-8 md:p-10">
          <div className="text-center mb-8">
            <span className="material-symbols-outlined text-4xl text-primary mb-2">confirmation_number</span>
            <h1 className="text-2xl font-bold text-gray-900">Εύρεση κράτησης</h1>
            <p className="text-sm text-gray-500 mt-2">
              Εισάγετε το email της κράτησης και τον κωδικό αναφοράς από το email επιβεβαίωσης
              (π.χ. <span className="font-mono text-xs">BK-A1B2C3D4</span>).
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="reference" className="block text-sm font-semibold text-gray-700 mb-1.5">
                Κωδικός αναφοράς
              </label>
              <input
                id="reference"
                name="reference"
                type="text"
                required
                autoComplete="off"
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 font-mono uppercase focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                placeholder="BK-XXXXXXXX"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-full bg-primary text-white font-bold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                  Αναζήτηση…
                </>
              ) : (
                <>
                  Εμφάνιση εισιτηρίου
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          <p className="text-xs text-center text-gray-500 mt-6">
            Για λόγους απορρήτου δεν εμφανίζονται όλες οι κρατήσεις του email — απαιτείται και ο κωδικός.
          </p>
          <p className="text-xs text-center mt-3">
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Σύνδεση στο My Wallet
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
