import { useMemo, useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
  getCustomerEmail,
  getCustomerToken,
  isCustomer,
  loginAsCustomer,
  logoutCustomer,
} from '../lib/auth.js';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';
import {
  verifyGoogleLogin,
  isCustomerAuthBackendAvailable,
} from '../services/customerAuthApi.js';
import {
  clearWalletClaim,
  getWalletClaim,
  walletClaimNavState,
  walletHomeNavState,
} from '../lib/wallet/walletClaim.js';
import { useRentPhone } from '../lib/rental/rentDevice.js';
import { isNativeApp } from '../lib/capacitor/isNativeApp.js';
import { isNativeUnifiedApp } from '../lib/capacitor/nativeAppId.js';
import {
  rememberNativeRoleHome,
  NATIVE_ROLE_DRIVER,
  NATIVE_ROLE_RENT,
  NATIVE_ROLE_WALLET,
} from '../lib/capacitor/nativeRoleHome.js';
import { attemptUnifiedLogin, resolveCustomerSurface } from '../lib/auth/unifiedLogin.js';
import { clearDriverSession, getDriverSession } from '../lib/driver/driverSession.js';
import { clearDriverShiftLaunchState } from '../lib/driver/useDriverShiftSession.js';
import { takeGoogleCredentialFromLocation } from '../lib/capacitor/nativeGoogleBridge.js';
import {
  clearPreferRentLookup,
  markPreferRentLookup,
} from '../lib/rental/preferRentLookup.js';
import '../styles/wallet-pass.css';
import '../styles/rental-pwa.css';

function isRentReturn(path) {
  if (typeof path !== 'string') return false;
  if (path === '/rent' || path.startsWith('/rent/')) return true;
  // Unified My Wallet rentals tab (legacy /rent/wallet redirects here).
  if (path === '/wallet?tab=rentals' || path.startsWith('/wallet?tab=rentals')) return true;
  return false;
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
  const isPhone = useRentPhone();
  // Path / prop still marks rent entrance for redirects (rentals tab) — same blue My Wallet UI.
  // Unified native app: allow /rent/login (and rentEntrance) so rent customers open rentals tab.
  const allowNativeRent =
    isNativeApp() && isNativeUnifiedApp() && (rentEntrance || isRentAuthPath(location.pathname));
  const pathRent =
    (!isNativeApp() || allowNativeRent) && (rentEntrance || isRentAuthPath(location.pathname));
  const bookingPayContinue =
    typeof location.state?.from === 'string' &&
    (location.state.from.includes('/rent/book/payment') || location.state?.rentBookingPay);
  const rentChrome =
    (pathRent || isRentReturn(location.state?.from) || bookingPayContinue) &&
    (!isNativeApp() || allowNativeRent);
  const preferRentHint = Boolean(rentChrome);
  const preferWalletHint =
    Boolean(location.state?.walletClaim) ||
    location.state?.from === '/wallet' ||
    (typeof location.state?.from === 'string' && location.state.from.startsWith('/wallet'));
  /** Rent deep-link / return — same My Wallet chrome; opens rentals tab after login. */
  const rentIntent = rentChrome;
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [backendOk, setBackendOk] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

  // Controlled fields (Capacitor WebView): uncontrolled + autofill often looks focused but ignores keys.
  useEffect(() => {
    if (prefillEmail && !email) setEmail(String(prefillEmail).trim().toLowerCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once from claim/session
  }, [prefillEmail]);

  useEffect(() => {
    isCustomerAuthBackendAvailable().then(setBackendOk);
  }, []);

  useEffect(() => {
    // Live driver JWT → command center (no separate «Είσοδος οδηγού» link).
    if (getDriverSession()?.accessToken) {
      rememberNativeRoleHome(NATIVE_ROLE_DRIVER);
      navigate('/driver', { replace: true });
      return;
    }
    // Already signed in as customer — resume last/correct surface.
    if (isCustomer() && getCustomerToken()) {
      const from = location.state?.from;
      if (typeof from === 'string' && from && from !== '/login' && from !== '/rent/login') {
        navigate(from, { replace: true });
        return;
      }
      void resolveCustomerSurface({
        preferRent: preferRentHint,
        preferWallet: preferWalletHint || Boolean(claim),
      }).then((surface) => {
        rememberNativeRoleHome(surface.role);
        navigate(surface.path, { replace: true });
      });
    }
  }, [
    navigate,
    preferRentHint,
    preferWalletHint,
    claim,
    location.state?.from,
  ]);

  const finishCustomerLogin = (email, profile = {}, accessToken = null, surface) => {
    try {
      clearDriverSession();
    } catch {
      /* ignore */
    }
    loginAsCustomer(email, profile, accessToken);
    const role = surface?.role || (rentIntent ? NATIVE_ROLE_RENT : NATIVE_ROLE_WALLET);
    const dest =
      surface?.path ||
      (rentIntent
        ? isRentReturn(location.state?.from)
          ? location.state.from
          : '/wallet?tab=rentals'
        : location.state?.from && !String(location.state.from).startsWith('/rent')
          ? location.state.from
          : '/wallet');
    rememberNativeRoleHome(role);
    const goingRent =
      role === NATIVE_ROLE_RENT ||
      String(dest).startsWith('/rent') ||
      String(dest).includes('tab=rentals');
    try {
      if (goingRent) markPreferRentLookup();
      else clearPreferRentLookup();
    } catch {
      /* ignore */
    }
    const hadClaim = Boolean(claim);
    clearWalletClaim();
    const homeState = walletHomeNavState({
      highlightBooking,
      fromClaim: hadClaim,
    });
    const rentLookupState = goingRent
      ? {
          rentAuthedAt: Date.now(),
          ...(location.state?.highlightRentalBooking
            ? {
                highlightRentalBooking: location.state.highlightRentalBooking,
                openRentWallet: true,
                rentLookup: true,
              }
            : {}),
          ...(highlightBooking ? homeState : {}),
        }
      : undefined;
    const nextState =
      String(dest).startsWith('/wallet')
        ? homeState
        : goingRent
          ? rentLookupState
          : highlightBooking
            ? homeState
            : undefined;
    navigate(dest, {
      replace: true,
      state: nextState,
    });
  };

  const finishDriverLogin = () => {
    try {
      // Clears customer JWT / userRole — restore driver role after (saveDriverSession
      // may have set it earlier, then parallel customer auth left a customer token).
      logoutCustomer();
    } catch {
      /* ignore */
    }
    try {
      localStorage.setItem('userRole', 'driver');
    } catch {
      /* ignore */
    }
    clearDriverShiftLaunchState();
    rememberNativeRoleHome(NATIVE_ROLE_DRIVER);
    navigate('/driver', { replace: true });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const emailN = email.trim().toLowerCase();
    const passwordN = password;

    if (emailN === 'admin@aerostride.com') {
      setError(
        'Αυτή η σελίδα δεν είναι για διαχείριση γραφείου. Χρησιμοποιήστε Admin Login.',
      );
      return;
    }
    if (!emailN) {
      setError('Εισάγετε email ή όνομα χρήστη.');
      return;
    }
    if (!passwordN.trim()) {
      setError('Εισάγετε κωδικό πρόσβασης.');
      return;
    }

    setLoading(true);
    try {
      const outcome = await attemptUnifiedLogin(emailN, passwordN, {
        preferRent: preferRentHint,
        preferWallet: preferWalletHint || Boolean(claim),
      });
      if (outcome.kind === 'driver') {
        finishDriverLogin();
        return;
      }
      const result = outcome.result;
      finishCustomerLogin(
        result.email,
        {
          name: result.name,
          picture: result.picture,
          provider: result.provider || 'email',
          phone: result.phone,
          customerId: result.customer_id,
          tenant_id: result.tenant_id,
        },
        result.access_token,
        { role: outcome.role, path: outcome.path },
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
      const surface = await resolveCustomerSurface({
        preferRent: preferRentHint,
        preferWallet: preferWalletHint || Boolean(claim),
      });
      finishCustomerLogin(
        profile.email,
        {
          name: profile.name,
          picture: profile.picture,
          provider: profile.provider || 'google',
          customerId: profile.customer_id,
          tenant_id: profile.tenant_id,
        },
        profile.access_token,
        surface,
      );
    } catch (err) {
      const msg = String(err?.message || err || '');
      if (/audience mismatch/i.test(msg)) {
        setError(
          'Google Client ID δεν ταιριάζει ακόμα με τον server. Ctrl+Shift+R (σκληρό refresh), περίμενε ~2 λεπτά μετά το Deploy, ξανά Σύνδεση με Google.',
        );
      } else {
        setError(msg || 'Αποτυχία σύνδεσης με Google');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // Capacitor: credential returned from /wallet/native-google on the office host.
  useEffect(() => {
    const cred = takeGoogleCredentialFromLocation(location);
    if (!cred) return;
    void handleGoogleCredential(cred);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on return from bridge
  }, []);

  const registerFrom = preferRentHint ? '/wallet?tab=rentals' : '/wallet';
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
          from: registerFrom,
        }
      : { from: registerFrom };

  const iconClass = 'material-symbols-outlined wallet-auth-icon';
  const leadClass = 'wallet-auth-lead';
  const linkClass = 'wallet-auth-link';
  const submitClass = 'wallet-auth-submit';
  const dividerClass = 'wallet-auth-divider';
  const homeHref = rentIntent ? '/rent' : '/';
  const registerHref = rentIntent ? '/rent/register' : '/register';

  const formBody = (
    <>
      <div className="text-center wallet-auth-hero">
        <span className={iconClass} aria-hidden>
          account_balance_wallet
        </span>
        <h1>
          {bookingPayContinue ? 'Ολοκλήρωση πληρωμής' : 'My Wallet'}
        </h1>
        {bookingPayContinue ? (
          <p className={leadClass}>
            Συνδεθείτε για να ολοκληρώσετε την κράτηση και την πληρωμή.
          </p>
        ) : null}
      </div>

      {claim ? (
        <div className="mb-5 rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/8 px-4 py-3 text-sm">
          <p className="font-bold text-[#0071e3] mb-1">Κράτηση έτοιμη για το Wallet</p>
          <p className="text-[#6e6e73]">
            Χρησιμοποιήστε το ίδιο email:{' '}
            <span className="font-semibold text-[#1d1d1f]">{prefillEmail}</span>
          </p>
        </div>
      ) : null}

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
          <label htmlFor="email">Email / χρήστης</label>
          <div className="relative">
            <span
              className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#8e8e93] text-lg pointer-events-none"
              aria-hidden
            >
              mail
            </span>
            <input
              id="email"
              name="email"
              type="text"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email ή όνομα χρήστη"
              required
              disabled={loading || googleLoading}
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
            <span
              className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#8e8e93] text-lg pointer-events-none"
              aria-hidden
            >
              lock
            </span>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              enterKeyHint="go"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Κωδικός πρόσβασης"
              required
              disabled={loading || googleLoading}
              style={{ paddingRight: '2.75rem' }}
            />
            <button
              type="button"
              className={`${linkClass} absolute right-3 top-1/2 -translate-y-1/2 p-1`}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
              aria-pressed={showPassword}
              tabIndex={-1}
            >
              <span className="material-symbols-outlined text-lg text-[#8e8e93]" aria-hidden>
                {showPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading || googleLoading} className={submitClass}>
          {loading ? 'Σύνδεση…' : 'Είσοδος'}
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </form>

      {/* Always show Google — GoogleSignInButton handles loading / unavailable.
          Native packaged app previously hid this when /api/google/config failed on localhost. */}
      <div className={`${dividerClass} mt-5`}>ή με Google</div>
      <div className="space-y-3 mt-2">
        <GoogleSignInButton
          disabled={googleLoading || loading}
          onSuccess={handleGoogleCredential}
          onDemoProfile={handleGoogleDemo}
          onError={setError}
        />
        {googleLoading ? (
          <p className="text-xs text-center text-[#6e6e73]">Επαλήθευση Google…</p>
        ) : null}
      </div>

      <p className="text-sm text-center text-[#6e6e73] mt-5">
        Δεν έχετε λογαριασμό;{' '}
        <Link
          to={registerHref}
          state={rentIntent ? { from: '/wallet?tab=rentals' } : registerState}
          className={linkClass}
        >
          Εγγραφή
        </Link>
      </p>
      {!isNativeApp() ? (
        <p className="text-xs text-center mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <Link to="/my-booking" className={linkClass}>
            Εύρεση κράτησης λεωφορείου
          </Link>
          <span className="text-[#d2d2d7]" aria-hidden>
            ·
          </span>
          <Link to="/rent/my-booking" className={linkClass}>
            Εύρεση κράτησης ενοικίασης
          </Link>
        </p>
      ) : null}
    </>
  );

  const nativeWallet = isNativeApp();
  // Native Capacitor app: always full-bleed phone chrome (never desktop aside).
  const phoneChrome = nativeWallet || isPhone;

  return (
    <div
      className={`wallet-auth-stage${phoneChrome ? '' : ' wallet-auth-stage--desktop'}${
        nativeWallet ? ' wallet-auth-stage--native' : ''
      }`}
    >
      <div className="wallet-auth-shell">
        <div className="wallet-auth-scroll">
          {!phoneChrome ? (
            <aside className="wallet-auth-aside" aria-label="My Wallet">
              <p className="wallet-auth-aside-kicker">My Wallet</p>
              <h2 className="wallet-auth-aside-title">
                Όλα σε ένα μέρος.<br />Πάντα μαζί σας.
              </h2>
              <p className="wallet-auth-aside-lead">
                Εισιτήρια λεωφορείου και κάρτες ενοικίασης — ένας λογαριασμός.
              </p>
            </aside>
          ) : null}
          <div className="wallet-auth-panel">
            <div className="wallet-auth-card">{formBody}</div>
            {!isNativeApp() ? (
              <Link to={homeHref} className="wallet-auth-back">
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Επιστροφή στην Αρχική
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
