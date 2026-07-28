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
import { useRentMobile } from '../lib/rental/rentDevice.js';
import '../styles/wallet-pass.css';
import '../styles/rental-pwa.css';

function isRentReturn(path) {
  return typeof path === 'string' && (path === '/rent' || path.startsWith('/rent/'));
}

function isRentAuthPath(pathname) {
  return (
    pathname === '/rent' ||
    pathname === '/rent/login' ||
    pathname === '/rent/register' ||
    (typeof pathname === 'string' && pathname.startsWith('/rent/'))
  );
}

export default function LoginPage({ rentEntrance = false } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useRentMobile();
  const { enabled: googleEnabled } = useGoogleAuthConfig();
  // Path / prop wins over shared /login — rent entrance must never look like bus My Wallet.
  const pathRent = rentEntrance || isRentAuthPath(location.pathname);
  const redirectTo = pathRent
    ? isRentReturn(location.state?.from)
      ? location.state.from
      : '/rent'
    : location.state?.from || '/wallet';
  const rentIntent = pathRent || isRentReturn(redirectTo);
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
    // Old deep-links used /login?state.from=/rent — stay on /rent (share URL), not /rent/login.
    if (
      location.pathname === '/login' &&
      isRentReturn(location.state?.from)
    ) {
      navigate('/rent', { replace: true, state: location.state });
    }
  }, [location.pathname, location.state, navigate]);

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
    // Rent: always bump location state so /rent gate remounts into the app.
    const nextState =
      redirectTo === '/wallet' || redirectTo.startsWith('/wallet')
        ? homeState
        : rentIntent
          ? { rentAuthedAt: Date.now(), ...(highlightBooking ? homeState : {}) }
          : highlightBooking
            ? homeState
            : undefined;
    navigate(redirectTo, {
      replace: true,
      state: nextState,
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

  const iconClass = rentIntent
    ? 'material-symbols-outlined rent-auth-icon'
    : 'material-symbols-outlined wallet-auth-icon';
  const leadClass = rentIntent ? 'rent-auth-lead' : 'wallet-auth-lead';
  const hintClass = rentIntent ? 'rent-auth-hint' : 'wallet-auth-hint';
  const linkClass = rentIntent ? 'rent-auth-link' : 'wallet-auth-link';
  const submitClass = rentIntent ? 'rent-auth-submit' : 'wallet-auth-submit';
  const dividerClass = rentIntent ? 'rent-auth-divider' : 'wallet-auth-divider';

  const formBody = (
    <>
      <div className="text-center mb-6">
        <span className={iconClass} aria-hidden>
          {rentIntent ? 'directions_car' : 'account_balance_wallet'}
        </span>
        <h1>{rentIntent ? 'Ενοικίαση' : 'My Wallet'}</h1>
        <p className={leadClass}>
          {rentIntent
            ? 'Σύνδεση για κράτηση οχήματος. Νέος πελάτης; Δημιουργήστε λογαριασμό πρώτα.'
            : claim
              ? 'Συνδεθείτε για να δείτε το εισιτήριο της κράτησής σας'
              : 'Σύνδεση για ταξίδια με λεωφορείο — ο λογαριασμός αποθηκεύεται στον server'}
        </p>
        <p className={hintClass}>
          {rentIntent
            ? 'Τα ταξίδια με λεωφορείο είναι στο My Wallet (μπλε) — εδώ είναι η ενοικίαση.'
            : 'Η ενοικίαση οχήματος είναι στην εφαρμογή Rent (πράσινο).'}
        </p>
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

      <div className={dividerClass}>{googleEnabled ? 'ή με email' : 'με email / κωδικό'}</div>

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
          <label htmlFor="email">Email</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#8e8e93] text-lg">
              mail
            </span>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={prefillEmail}
              placeholder="email@example.com"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label htmlFor="password">Κωδικός</label>
            <Link to="/forgot-password" className={`${linkClass} text-xs`}>
              Ξέχασα τον κωδικό
            </Link>
          </div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#8e8e93] text-lg">
              lock
            </span>
            <input id="password" name="password" type="password" placeholder="••••••••" required />
          </div>
        </div>

        <button type="submit" disabled={loading || googleLoading} className={submitClass}>
          {loading ? 'Σύνδεση…' : 'Είσοδος'}
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </form>

      <p className="text-sm text-center text-[#6e6e73] mt-5">
        Δεν έχετε λογαριασμό;{' '}
        <Link
          to={rentIntent ? '/rent/register' : '/register'}
          state={rentIntent ? { from: '/rent' } : registerState}
          className={linkClass}
        >
          {rentIntent ? 'Δημιουργία λογαριασμού' : 'Εγγραφή'}
        </Link>
      </p>
      {!rentIntent ? (
        <p className="text-xs text-center mt-3">
          <Link to="/my-booking" className={linkClass}>
            Εύρεση κράτησης
          </Link>
        </p>
      ) : null}
    </>
  );

  if (rentIntent) {
    return (
      <div className={`rent-auth-stage${isMobile ? '' : ' rent-auth-stage--desktop'}`}>
        <div className="rent-auth-shell">
          <div className="rent-auth-scroll">
            <div className="rent-auth-card">{formBody}</div>
            <Link to="/" className="rent-auth-back">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Επιστροφή στην Αρχική
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`wallet-auth-stage${isMobile ? '' : ' wallet-auth-stage--desktop'}`}>
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
