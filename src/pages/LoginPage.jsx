import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
  getCustomerEmail,
  isCustomer,
  loginAsCustomer,
  isAdmin,
  isDriver,
} from '../lib/auth.js';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';
import {
  verifyGoogleLogin,
  isGoogleAuthConfigured,
  loginCustomer,
  isCustomerAuthBackendAvailable,
} from '../services/customerAuthApi.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/wallet';
  const walletIntent = location.state?.from === '/wallet';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [backendOk, setBackendOk] = useState(null);

  useEffect(() => {
    isCustomerAuthBackendAvailable().then(setBackendOk);
  }, []);

  useEffect(() => {
    if (walletIntent) return;
    if (isCustomer()) {
      navigate(redirectTo, { replace: true });
      return;
    }
    if (isAdmin()) {
      navigate('/admin', { replace: true });
      return;
    }
    if (isDriver()) {
      navigate('/driver', { replace: true });
    }
  }, [navigate, redirectTo, walletIntent]);

  const finishLogin = (email, profile = {}, accessToken = null) => {
    loginAsCustomer(email, profile, accessToken);
    navigate(redirectTo, { replace: true });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const email = e.target.email.value.trim().toLowerCase();
    const password = e.target.password.value;

    if (email === 'admin@aerostride.com' || email === 'driver@aerostride.com') {
      setError(
        'Αυτή η σελίδα είναι μόνο για πελάτες. Για διαχείριση χρησιμοποιήστε Admin Login.',
      );
      return;
    }
    if (!password.trim()) {
      setError('Εισάγετε κωδικό πρόσβασης.');
      return;
    }

    setLoading(true);
    try {
      const result = await loginCustomer({ email, password });
      finishLogin(
        result.email,
        {
          name: result.name,
          picture: result.picture,
          provider: result.provider || 'email',
          phone: result.phone,
          customerId: result.customer_id,
        },
        result.access_token,
      );
    } catch (err) {
      const msg = err.message || 'Αποτυχία σύνδεσης';
      if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network')) {
        setError('Ο server δεν είναι διαθέσιμος. Ξεκινήστε το backend (port 8000).');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleDemo = (profile) => {
    setError('Για demo Google χρειάζεται backend — χρησιμοποιήστε εγγραφή/email ή ρυθμίστε Google OAuth.');
  };

  const handleGoogleCredential = async (credential) => {
    setError('');
    setGoogleLoading(true);
    try {
      const profile = await verifyGoogleLogin(credential);
      finishLogin(
        profile.email,
        {
          name: profile.name,
          picture: profile.picture,
          provider: profile.provider || 'google',
          customerId: profile.customer_id,
        },
        profile.access_token,
      );
    } catch (err) {
      setError(err.message || 'Αποτυχία σύνδεσης με Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary-fixed rounded-full blur-[120px] opacity-40" />

      <div className="bg-surface-container-lowest p-10 md:p-14 rounded-[32px] shadow-level-2 card-inner-border w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <span className="material-symbols-outlined text-4xl text-primary mb-3">account_balance_wallet</span>
          <h1 className="font-headline-md text-headline-md font-bold text-on-surface tracking-tight mb-2">
            My Wallet
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Σύνδεση πελάτη — ο λογαριασμός σας αποθηκεύεται στον server
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <GoogleSignInButton
            disabled={googleLoading || loading}
            onSuccess={handleGoogleCredential}
            onDemoProfile={handleGoogleDemo}
            onError={setError}
          />
          {googleLoading && (
            <p className="text-xs text-center text-gray-500">Επαλήθευση Google…</p>
          )}
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 font-bold uppercase">
            {isGoogleAuthConfigured() ? 'ή με email' : 'με email / κωδικό'}
          </span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {backendOk === false && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              Ο server δεν τρέχει. Σε νέο terminal:{' '}
              <code className="text-xs bg-white px-1 rounded">npm run dev:backend</code>
            </p>
          )}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <label className="block font-label-md text-label-md text-on-surface" htmlFor="email">
              Email
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-lg">
                mail
              </span>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={getCustomerEmail() || ''}
                className="w-full pl-12 pr-4 py-4 bg-surface-container-low border-0 rounded-2xl focus:ring-2 focus:ring-primary-container"
                placeholder="email@example.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block font-label-md text-label-md text-on-surface" htmlFor="password">
                Κωδικός
              </label>
              <Link to="/forgot-password" className="text-xs text-primary font-semibold hover:underline">
                Ξέχασα τον κωδικό
              </Link>
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-lg">
                lock
              </span>
              <input
                id="password"
                name="password"
                type="password"
                className="w-full pl-12 pr-4 py-4 bg-surface-container-low border-0 rounded-2xl focus:ring-2 focus:ring-primary-container"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full mt-4 bg-primary-container text-white py-4 rounded-full font-label-md hover:scale-[0.98] transition-transform shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? 'Σύνδεση…' : 'Είσοδος'}
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </form>

        <p className="text-sm text-center text-gray-600 mt-6">
          Δεν έχετε λογαριασμό;{' '}
          <Link to="/register" className="text-primary font-bold hover:underline">
            Εγγραφή
          </Link>
        </p>
        <p className="text-xs text-center text-gray-500 mt-4">
          <Link to="/my-booking" className="text-primary font-semibold hover:underline">
            Εύρεση κράτησης
          </Link>
          {' · '}
          <Link to="/admin/login" className="text-primary font-semibold hover:underline">
            Admin Login
          </Link>
        </p>
      </div>

      <div className="mt-8 text-center relative z-10">
        <Link
          to="/"
          className="font-label-md text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 justify-center"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Επιστροφή στην Αρχική
        </Link>
      </div>
    </div>
  );
}
