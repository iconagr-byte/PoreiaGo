import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import OfficeBrandMark from '../components/storefront/OfficeBrandMark.jsx';
import { fetchResumeCart } from '../services/abandonedApi.js';
import { savePendingCheckout } from '../lib/ticketing/pendingCheckout.js';
import { loadTrips } from '../lib/trips/tripStore.js';

export default function CheckoutResumePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cart = await fetchResumeCart(token);
        if (cancelled) return;
        const trip = loadTrips().find((t) => t.id === cart.trip_id);
        if (!trip) {
          setError('Η εκδρομή δεν είναι πλέον διαθέσιμη.');
          return;
        }
        savePendingCheckout({
          tripId: cart.trip_id,
          seats: cart.seats,
          total: cart.amount_eur,
          passengerName: cart.passenger_name,
          passengerEmail: cart.passenger_email,
          passengerPhone: cart.passenger_phone,
        });
        toast.success('Η κράτησή σας φορτώθηκε — συνεχίστε την πληρωμή');
        navigate(`/checkout/${cart.trip_id}`, { replace: true });
      } catch (e) {
        if (!cancelled) {
          const msg = e.message || 'Αποτυχία φόρτωσης';
          setError(
            msg.includes('HTML')
              ? `${msg} Επανεκκινήστε το frontend (npm run dev) μετά την αλλαγή proxy.`
              : msg,
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4">
      <OfficeBrandMark className="h-10 mb-8" variant="light" />
      {loading && (
        <p className="text-on-surface-variant flex items-center gap-2">
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          Φόρτωση κράτησης…
        </p>
      )}
      {error && (
        <div className="text-center max-w-md">
          <p className="text-red-600 mb-4">{error}</p>
          <Link to="/" className="text-primary font-bold hover:underline">
            Επιστροφή στην αρχική
          </Link>
        </div>
      )}
    </div>
  );
}
