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
  const isPhone = useRentPhone();
  // Path / prop wins over shared /login — rent entrance must never look like bus My Wallet.
  // Unified native app: allow /rent/login (and rentEntrance) so rent customers open Rent menu.
  const allowNativeRent =
    isNativeApp() && isNativeUnifiedApp() && (rentEntrance || isRentAuthPath(location.pathname));
  const pathRent =
    (!isNativeApp() || allowNativeRent) && (rentEntrance || isRentAuthPath(location.pathname));
  const bookingPayContinue =
    typeof location.state?.from === 'string' &&
    (location.state.from.includes('/rent/book/payment') || location.state?.rentBookingPay);
  // Deep-link /rent/* still paints green Rent chrome; plain /login auto-detects role.
  const rentChrome =
    (pathRent || isRentReturn(location.state?.from) || bookingPayContinue) &&
    (!isNativeApp() || allowNativeRent);
  const preferRentHint = Boolean(rentChrome);
  const preferWalletHint =
    Boolean(location.state?.walletClaim) ||
    location.state?.from === '/wallet' ||
    (typeof location.state?.from === 'string' && location.state.from.startsWith('/wallet'));
  const rentIntent = rentChrome;
  const walletIntent = !rentIntent && preferWalletHint;
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
          : '/rent/wallet'
        : location.state?.from && !String(location.state.from).startsWith('/rent')
          ? location.state.from
          : '/wallet');
    rememberNativeRoleHome(role);
    const hadClaim = Boolean(claim);
    clearWalletClaim();
    const homeState = walletHomeNavState({
      highlightBooking,
      fromClaim: hadClaim,
    });
    const goingRent = role === NATIVE_ROLE_RENT || String(dest).startsWith('/rent');
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
      logoutCustomer();
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

  const registerFrom = preferRentHint ? '/rent/wallet' : '/wallet';
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

  const iconClass = rentIntent
    ? 'material-symbols-outlined rent-auth-icon'
    : 'material-symbols-outlined wallet-auth-icon';
  const leadClass = rentIntent ? 'rent-auth-lead' : 'wallet-auth-lead';
  const linkClass = rentIntent ? 'rent-auth-link' : 'wallet-auth-link';
  const submitClass = rentIntent ? 'rent-auth-submit' : 'wallet-auth-submit';
  const dividerClass = rentIntent ? 'rent-auth-divider' : 'wallet-auth-divider';

  const formBody = (
    <>
      <div className={`text-center ${rentIntent ? 'mb-6' : 'wallet-auth-hero'}`}>
        <span className={iconClass} aria-hidden>
          {rentIntent ? 'directions_car' : 'account_balance_wallet'}
        </span>
        <h1>
          {bookingPayContinue ? 'Ολοκλήρωση πληρωμής' : rentIntent ? 'Rent Wallet' : 'My Wallet'}
        </h1>
        {bookingPayContinue || rentIntent ? (
          <p className={leadClass}>
            {bookingPayContinue
              ? 'Συνδεθείτε για να ολοκληρώσετε την κράτηση και την πληρωμή.'
              : 'Σύνδεση για ενοικίαση οχήματος'}
          </p>
        ) : (
          <p className={leadClass}>
            Ένας λογαριασμός — ανοίγει αυτόματα το σωστό wallet (πελάτης ή οδηγός).
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
          to={rentIntent ? '/rent/register' : '/register'}
          state={rentIntent ? { from: '/rent/wallet' } : registerState}
          className={linkClass}
        >
          {rentIntent ? 'Δημιουργία λογαριασμού' : 'Εγγραφή'}
        </Link>
      </p>
      {!isNativeApp() ? (
        !rentIntent ? (
          <p className="text-xs text-center mt-3">
            <Link to="/my-booking" className={linkClass}>
              Εύρεση κράτησης λεωφορείου
            </Link>
          </p>
        ) : (
          <p className="text-xs text-center mt-3">
            <Link to="/rent/my-booking" className={linkClass}>
              Εύρεση κράτησης ενοικίασης
            </Link>
          </p>
        )
      ) : null}
    </>
  );

  if (rentIntent) {
    // Tablets get full-bleed desktop auth (not the phone bezel). Phones keep compact chrome.
    const phoneChrome = isPhone;
    return (
      <div className={`rent-auth-stage${phoneChrome ? '' : ' rent-auth-stage--desktop'}`}>
        <div className="rent-auth-shell">
          <div className="rent-auth-scroll">
            {!phoneChrome ? (
              <aside className="rent-auth-aside rent-auth-aside--left" aria-label="Τι είναι το Rent Wallet">
                <p className="rent-auth-aside-kicker">Rent Wallet · Ενοικιάσεις</p>
                <h2 className="rent-auth-aside-title">
                  Η κράτησή σας,
                  <br />
                  πάντα στο κινητό
                </h2>
                <p className="rent-auth-aside-lead">
                  Ένας λογαριασμός μόνο για ενοικίαση οχήματος — κρατήσεις, πληρωμές και QR
                  παραλαβής, χωριστά από τα λεωφορεία.
                </p>
                <ul className="rent-auth-aside-list">
                  <li>
                    <span className="material-symbols-outlined" aria-hidden>
                      directions_car
                    </span>
                    <div>
                      <strong>Κρατήσεις οχημάτων</strong>
                      <span>Επιβατικά, van και υπηρεσίες σε μία λίστα.</span>
                    </div>
                  </li>
                  <li>
                    <span className="material-symbols-outlined" aria-hidden>
                      qr_code_2
                    </span>
                    <div>
                      <strong>QR παραλαβής</strong>
                      <span>Δείξτε το στο γραφείο χωρίς email ή PDF.</span>
                    </div>
                  </li>
                  <li>
                    <span className="material-symbols-outlined" aria-hidden>
                      payments
                    </span>
                    <div>
                      <strong>Πληρωμές & κατάθεση</strong>
                      <span>Κάρτα, τράπεζα ή μετρητά — ξεκάθαρο υπόλοιπο.</span>
                    </div>
                  </li>
                </ul>
              </aside>
            ) : null}

            <div className="rent-auth-panel">
              <div className="rent-auth-card">{formBody}</div>
              <Link to="/rent" className="rent-auth-back">
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Επιστροφή στην Αρχική
              </Link>
            </div>

            {!phoneChrome ? (
              <aside className="rent-auth-aside rent-auth-aside--right" aria-label="Πώς λειτουργεί">
                <p className="rent-auth-aside-kicker">Πώς λειτουργεί</p>
                <h2 className="rent-auth-aside-title rent-auth-aside-title--sm">
                  Από την αναζήτηση
                  <br />
                  στην παραλαβή
                </h2>
                <ol className="rent-auth-aside-steps">
                  <li>
                    <span className="rent-auth-aside-step">1</span>
                    <div>
                      <strong>Βρείτε όχημα</strong>
                      <span>Ημερομηνίες, τοποθεσία και κατηγορία.</span>
                    </div>
                  </li>
                  <li>
                    <span className="rent-auth-aside-step">2</span>
                    <div>
                      <strong>Ολοκληρώστε πληρωμή</strong>
                      <span>Επιβεβαίωση κράτησης σε λίγα βήματα.</span>
                    </div>
                  </li>
                  <li>
                    <span className="rent-auth-aside-step">3</span>
                    <div>
                      <strong>Παραλάβετε με QR</strong>
                      <span>Όλα στο Wallet — χωρίς χαρτιά.</span>
                    </div>
                  </li>
                </ol>
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

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
                Απλή, ασφαλής πρόσβαση στον λογαριασμό σας.
              </p>
            </aside>
          ) : null}
          <div className="wallet-auth-panel">
            <div className="wallet-auth-card">{formBody}</div>
            {!isNativeApp() ? (
              <Link to="/" className="wallet-auth-back">
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
