import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginAsCustomer } from '../lib/auth.js';
import { registerCustomer, isCustomerAuthBackendAvailable } from '../services/customerAuthApi.js';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendOk, setBackendOk] = useState(null);

  useEffect(() => {
    isCustomerAuthBackendAvailable().then(setBackendOk);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const form = e.target;
    const email = form.email.value.trim().toLowerCase();
    const name = form.name.value.trim();
    const password = form.password.value;
    const confirm = form.confirm.value;

    if (password !== confirm) {
      setError('Οι κωδικοί δεν ταιριάζουν');
      return;
    }
    if (password.length < 6) {
      setError('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες');
      return;
    }

    setLoading(true);
    try {
      const result = await registerCustomer({ email, password, name });
      loginAsCustomer(
        result.email,
        {
          name: result.name,
          picture: result.picture,
          provider: result.provider || 'email',
          customerId: result.customer_id,
        },
        result.access_token,
      );
      navigate('/wallet', { replace: true });
    } catch (err) {
      setError(err.message || 'Αποτυχία εγγραφής');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4">
      <div className="bg-surface-container-lowest p-10 md:p-14 rounded-[32px] shadow-level-2 w-full max-w-md">
        <div className="text-center mb-8">
          <span className="material-symbols-outlined text-4xl text-primary mb-3">person_add</span>
          <h1 className="text-2xl font-bold text-on-surface">Εγγραφή πελάτη</h1>
          <p className="text-sm text-on-surface-variant mt-2">Δημιουργήστε λογαριασμό My Wallet</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {backendOk === false && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              Ο server δεν τρέχει. Ανοίξτε νέο terminal και εκτελέστε:{' '}
              <code className="text-xs bg-white px-1 rounded">npm run dev:backend</code>
            </p>
          )}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-bold" htmlFor="name">Ονοματεπώνυμο</label>
            <input
              id="name"
              name="name"
              type="text"
              className="w-full px-4 py-3.5 bg-surface-container-low rounded-2xl focus:ring-2 focus:ring-primary-container"
              placeholder="Γιώργος Π."
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full px-4 py-3.5 bg-surface-container-low rounded-2xl focus:ring-2 focus:ring-primary-container"
              placeholder="email@example.com"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold" htmlFor="password">Κωδικός</label>
            <input
              id="password"
              name="password"
              type="password"
              minLength={6}
              required
              className="w-full px-4 py-3.5 bg-surface-container-low rounded-2xl focus:ring-2 focus:ring-primary-container"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold" htmlFor="confirm">Επιβεβαίωση κωδικού</label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              minLength={6}
              required
              className="w-full px-4 py-3.5 bg-surface-container-low rounded-2xl focus:ring-2 focus:ring-primary-container"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-full bg-primary-container text-white font-bold disabled:opacity-60"
          >
            {loading ? 'Δημιουργία…' : 'Δημιουργία λογαριασμού'}
          </button>
        </form>

        <p className="text-sm text-center mt-6 text-gray-600">
          Έχετε ήδη λογαριασμό;{' '}
          <Link to="/login" className="text-primary font-bold hover:underline">
            Σύνδεση
          </Link>
        </p>
      </div>
    </div>
  );
}
