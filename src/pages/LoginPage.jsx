import { useMemo, useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
  getCustomerEmail,
  getCustomerToken,
  isCustomer,
  loginAsCustomer,
  isAdmin,
  isDriver,
} from '../lib/auth.js';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';
import { useGoogleAuthConfig } from '../components/GoogleAuthRoot.jsx';
import {
  verifyGoogleLogin,
  loginCustomer,
  isCustomerAuthBackendAvailable,
} from '../services/customerAuthApi.js';
import {
  clearWalletClaim,
  getWalletClaim,
  walletClaimNavState,
  walletHomeNavState,
} from '../lib/wallet/walletClaim.js';
import '../styles/wallet-pass.css';

function isRentReturn(path) {
  return typeof path === 'string' && (path === '/rent' || path.startsWith('/rent/'));
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { enabled: googleEnabled } = useGoogleAuthConfig();
  const redirectTo = location.state?.from || '/wallet';
  const rentIntent = isRentReturn(redirectTo);
  const walletIntent =
    !rentIntent && (location.state?.from === '/wallet' || Boolean(location.state?.walletClaim));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [backendOk, setBackendOk] = useState(null);

  const claim = useMemo(() => {
    const fromState = location.state?.walletClaim
      ? {
          email: location.state.email,
          name: location.state.name,
          phone: location.state.phone,
          bookingId: location.state.highlightBooking,
          reference: location.state.reference,
          source: location.state.claimSource || 'manual',
        }
      : null;
    return fromState?.email ? fromState : getWalletClaim();
  }, [location.state]);

  const prefillEmail = claim?.email || getCustomerEmail() || '';
  const highlightBooking = claim?.bookingId || location.state?.highlightBooking;

  useEffect(() => {
    isCustomerAuthBackendAvailable().then(setBackendOk);
  }, []);

  useEffect(() => {
    if (walletIntent) return;
    if (isCustomer() && getCustomerToken()) {
      navigate(redirectTo, { replace: true });
      return;
    }
    // Rent login is for vehicle customers — keep admins/drivers on this page only for wallet.
    if (rentIntent) return;
    if (isAdmin()) {
      navigate('/admin', { replace: true });
      return;
    }
    if (isDriver()) {
      navigate('/driver', { replace: true });
    }
  }, [navigate, redirectTo, walletIntent, rentIntent]);

  const finishLogin = (email, profile = {}, accessToken = null) => {
    loginAsCustomer(email, profile, accessToken);
    const hadClaim = Boolean(claim);
    clearWalletClaim();
    const homeState = walletHomeNavState({
      highlightBooking,
      fromClaim: hadClaim,
    });
    navigate(redirectTo, {
      replace: true,
      state: redirectTo === '/wallet' || redirectTo.startsWith('/wallet')
        ? homeState
        : highlightBooking
          ? homeState
          : undefined,
    });
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

  const registerState =
    claim && !rentIntent
      ? {
          ...walletClaimNavState({
            email: prefillEmail,
            name: claim.name,
            phone: claim.phone,
            bookingId: highlightBooking,
            reference: claim.reference,
            source: claim.source || 'manual',
            createdAt: Date.now(),
          }),
          from: redirectTo,
        }
      : { from: redirectTo };

  const formBody = (
    <>
      <div className={rentIntent ? 'text-center mb-10' : 'text-center mb-6'}>
        <span
          className={
            rentIntent
              ? 'material-symbols-outlined text-4xl text-primary mb-3'
              : 'material-symbols-outlined wallet-auth-icon'
          }
          aria-hidden
        >
          {rentIntent ? 'directions_car' : 'account_balance_wallet'}
        </span>
        <h1
          className={
            rentIntent
              ? 'font-headline-md text-headline-md font-bold text-on-surface tracking-tight mb-2'
              : undefined
          }
        >
          {rentIntent ? 'Ενοικίαση' : 'My Wallet'}
        </h1>
        <p className={rentIntent ? 'font-body-md text-body-md text-on-surface-variant' : 'wallet-auth-lead'}>
          {rentIntent
            ? 'Σύνδεση για κράτηση οχήματος. Νέος πελάτης; Δημιουργήστε λογαριασμό πρώτα.'
            : claim
              ? 'Συνδεθείτε για να δείτε το εισιτήριο της κράτησής σας'
              : 'Σύνδεση για ταξίδια με λεωφορείο — ο λογαριασμός αποθηκεύεται στον server'}
        </p>
        {!rentIntent ? (
          <p className="wallet-auth-hint">Η ενοικίαση οχήματος είναι στην εφαρμογή Rent (teal).</p>
        ) : (
          <p className="text-xs text-on-surface-variant mt-2">
            Τα ταξίδια με λεωφορείο είναι στο My Wallet — εδώ είναι η ενοικίαση οχήματος.
          </p>
        )}
      </div>

      {claim && !rentIntent ? (
        <div className="mb-5 rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/8 px-4 py-3 text-sm">
          <p className="font-bold text-[#0071e3] mb-1">Κράτηση έτοιμη για το Wallet</p>
          <p className="text-[#6e6e73]">
            Χρησιμοποιήστε το ίδιο email:{' '}
            <span className="font-semibold text-[#1d1d1f]">{prefillEmail}</span>
          </p>
        </div>
      ) : null}

      <div className="space-y-3 mb-2">
        <GoogleSignInButton
          disabled={googleLoading || loading}
          onSuccess={handleGoogleCredential}
          onDemoProfile={handleGoogleDemo}
          onError={setError}
        />
        {googleLoading ? <p className="text-xs text-center text-[#6e6e73]">Επαλήθευση Google…</p> : null}
      </div>

      {rentIntent ? (
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 font-bold uppercase">
            {googleEnabled ? 'ή με email' : 'με email / κωδικό'}
          </span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
      ) : (
        <div className="wallet-auth-divider">{googleEnabled ? 'ή με email' : 'με email / κωδικό'}</div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        {backendOk === false ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            {import.meta.env.PROD
              ? 'Η σύνδεση με τον server απέτυχε. Ανανεώστε τη σελίδα ή δοκιμάστε σε λίγο.'
              : (
                <>
                  Ο server δεν τρέχει. Σε νέο terminal:{' '}
                  <code className="text-xs bg-white px-1 rounded">npm run dev:backend</code>
                </>
              )}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            {error}
          </p>
        ) : null}

        <div className="space-y-2">
          <label
            className={rentIntent ? 'block font-label-md text-label-md text-on-surface' : undefined}
            htmlFor="email"
          >
            Email
          </label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#8e8e93] text-lg">
              mail
            </span>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={prefillEmail}
              className={
                rentIntent
                  ? 'w-full pl-12 pr-4 py-4 bg-surface-container-low border-0 rounded-2xl focus:ring-2 focus:ring-primary-container'
                  : undefined
              }
              placeholder="email@example.com"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label
              className={rentIntent ? 'block font-label-md text-label-md text-on-surface' : undefined}
              htmlFor="password"
            >
              Κωδικός
            </label>
            <Link
              to="/forgot-password"
              className={rentIntent ? 'text-xs text-primary font-semibold hover:underline' : 'wallet-auth-link text-xs'}
            >
              Ξέχασα τον κωδικό
            </Link>
          </div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#8e8e93] text-lg">
              lock
            </span>
            <input
              id="password"
              name="password"
              type="password"
              className={
                rentIntent
                  ? 'w-full pl-12 pr-4 py-4 bg-surface-container-low border-0 rounded-2xl focus:ring-2 focus:ring-primary-container'
                  : undefined
              }
              placeholder="••••••••"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || googleLoading}
          className={
            rentIntent
              ? 'w-full mt-4 bg-primary-container text-white py-4 rounded-full font-label-md hover:scale-[0.98] transition-transform shadow-md flex items-center justify-center gap-2 disabled:opacity-60'
              : 'wallet-auth-submit'
          }
        >
          {loading ? 'Σύνδεση…' : 'Είσοδος'}
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </form>

      <p className={`text-sm text-center mt-5 ${rentIntent ? 'text-gray-600' : 'text-[#6e6e73]'}`}>
        Δεν έχετε λογαριασμό;{' '}
        <Link
          to="/register"
          state={registerState}
          className={rentIntent ? 'text-primary font-bold hover:underline' : 'wallet-auth-link'}
        >
          {rentIntent ? 'Δημιουργία λογαριασμού' : 'Εγγραφή'}
        </Link>
      </p>
      {!rentIntent ? (
        <p className="text-xs text-center mt-3">
          <Link to="/my-booking" className="wallet-auth-link">
            Εύρεση κράτησης
          </Link>
        </p>
      ) : null}
    </>
  );

  if (!rentIntent) {
    return (
      <div className="wallet-auth-stage">
        <div className="wallet-auth-shell">
          <div className="wallet-auth-scroll">
            <div className="wallet-auth-card">{formBody}</div>
            <Link to="/" className="wallet-auth-back">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Επιστροφή στην Αρχική
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary-fixed rounded-full blur-[120px] opacity-40" />
      <div className="bg-surface-container-lowest p-10 md:p-14 rounded-[32px] shadow-level-2 card-inner-border w-full max-w-md relative z-10">
        {formBody}
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
