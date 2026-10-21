import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { loginAsCustomer } from '../lib/auth.js';
import {
  registerCustomer,
  verifyGoogleLogin,
  isCustomerAuthBackendAvailable,
} from '../services/customerAuthApi.js';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';
import PasswordField from '../components/PasswordField.jsx';
import {
  clearWalletClaim,
  getWalletClaim,
  walletClaimNavState,
  walletHomeNavState,
} from '../lib/wallet/walletClaim.js';
import { useRentPhone } from '../lib/rental/rentDevice.js';
import { isNativeApp } from '../lib/capacitor/isNativeApp.js';
import { takeGoogleCredentialFromLocation } from '../lib/capacitor/nativeGoogleBridge.js';
import '../styles/wallet-pass.css';
import '../styles/rental-pwa.css';
import '../styles/customer-auth.css';

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

function isWalletReturn(path) {
  return typeof path === 'string' && (path === '/wallet' || path.startsWith('/wallet/'));
}

/**
 * Genuine wallet claim/activate: nav state from checkout/lookup/magic link,
 * or resume a session claim only when returning to /wallet (not storefront).
 * Storefront «Εγγραφή» sets cleanRegister and must never show claim chrome.
 */
function resolveClaim(locationState) {
  if (locationState?.cleanRegister) return null;
  const fromState = locationState?.walletClaim
    ? {
        email: locationState.email,
        name: locationState.name,
        phone: locationState.phone,
        bookingId: locationState.highlightBooking,
        reference: locationState.reference,
        source: locationState.claimSource || 'manual',
      }
    : null;
  if (fromState?.email) return fromState;
  const from = locationState?.from;
  if (from && !isWalletReturn(from)) return null;
  return getWalletClaim();
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isPhone = useRentPhone();
  const pathRent = isRentAuthPath(location.pathname);
  const cleanRegister = Boolean(location.state?.cleanRegister) && !pathRent;
  const redirectTo = pathRent
    ? isRentReturn(location.state?.from)
      ? location.state.from
      : '/rent/wallet'
    : cleanRegister
      ? location.state?.from || '/'
      : location.state?.from || '/wallet';
  const rentIntent = pathRent || isRentReturn(redirectTo);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [backendOk, setBackendOk] = useState(null);

  const claim = useMemo(
    () => (rentIntent ? null : resolveClaim(location.state)),
    [location.state, rentIntent],
  );

  const prefillEmail = claim?.email || '';
  const prefillName = claim?.name || '';
  const highlightBooking = claim?.bookingId || location.state?.highlightBooking;
  const walletClaimFlow = Boolean(claim) && !rentIntent && !cleanRegister;

  useEffect(() => {
    isCustomerAuthBackendAvailable().then(setBackendOk);
  }, []);

  useEffect(() => {
    if (
      location.pathname === '/register' &&
      isRentReturn(location.state?.from)
    ) {
      navigate('/rent/register', { replace: true, state: location.state });
    }
  }, [location.pathname, location.state, navigate]);

  const finishRegister = (email, profile = {}, accessToken = null) => {
    loginAsCustomer(email, profile, accessToken);
    const hadClaim = Boolean(claim);
    clearWalletClaim();
    if (rentIntent) {
      navigate(redirectTo, { replace: true });
      return;
    }
    if (walletClaimFlow || isWalletReturn(redirectTo)) {
      navigate(isWalletReturn(redirectTo) ? redirectTo : '/wallet', {
        replace: true,
        state: walletHomeNavState({
          highlightBooking,
          fromClaim: hadClaim,
        }),
      });
      return;
    }
    // Clean storefront / checkout signup — stay where the guest came from.
    navigate(redirectTo || '/', { replace: true });
  };

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
    if (!name || name.length < 2) {
      setError('Συμπληρώστε το ονοματεπώνυμο του επιβάτη');
      return;
    }
    if (password.length < 6) {
      setError('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες');
      return;
    }

    setLoading(true);
    try {
      const result = await registerCustomer({ email, password, name });
      finishRegister(
        result.email,
        {
          name: result.name,
          picture: result.picture,
          provider: result.provider || 'email',
          customerId: result.customer_id,
          tenant_id: result.tenant_id,
        },
        result.access_token,
      );
    } catch (err) {
      const msg = err.message || 'Αποτυχία εγγραφής';
      if (msg.toLowerCase().includes('υπάρχει') || msg.toLowerCase().includes('already')) {
        setError('Υπάρχει ήδη λογαριασμός με αυτό το email — κάντε σύνδεση.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleDemo = () => {
    setError(
      'Για demo Google χρειάζεται backend — χρησιμοποιήστε email ή ρυθμίστε Google OAuth.',
    );
  };

  const handleGoogleCredential = async (credential) => {
    setError('');
    setGoogleLoading(true);
    try {
      const profile = await verifyGoogleLogin(credential);
      finishRegister(
        profile.email,
        {
          name: profile.name,
          picture: profile.picture,
          provider: profile.provider || 'google',
          customerId: profile.customer_id,
          tenant_id: profile.tenant_id,
        },
        profile.access_token,
      );
    } catch (err) {
      const msg = String(err?.message || err || '');
      if (/audience mismatch/i.test(msg)) {
        setError(
          'Google OK στο app — ο server έχει παλιό Client ID. Merge το PR στο main (Deploy VPS) και ξαναδοκίμασε σε ~2 λεπτά.',
        );
      } else {
        setError(msg || 'Αποτυχία εγγραφής με Google');
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

  const loginState =
    claim && !rentIntent
      ? {
          ...walletClaimNavState(
            {
              email: prefillEmail,
              name: prefillName,
              phone: claim.phone,
              bookingId: highlightBooking,
              reference: claim.reference,
              source: claim.source || 'manual',
              createdAt: Date.now(),
            },
            { preferLogin: true },
          ),
          from: redirectTo,
        }
      : cleanRegister
        ? { from: redirectTo, cleanRegister: true }
        : { from: redirectTo };

  const nativeWallet = isNativeApp();
  const phoneChrome = nativeWallet || isPhone;
  const useCustomerShell = cleanRegister || (!rentIntent && !walletClaimFlow && !nativeWallet);

  const shellClass = rentIntent
    ? `rent-auth-stage${phoneChrome ? '' : ' rent-auth-stage--desktop'}`
    : useCustomerShell
      ? `customer-auth-stage${phoneChrome ? '' : ' customer-auth-stage--desktop'}`
      : `wallet-auth-stage${phoneChrome ? '' : ' wallet-auth-stage--desktop'}${
          nativeWallet ? ' wallet-auth-stage--native' : ''
        }`;
  const cardClass = rentIntent
    ? 'rent-auth-shell'
    : useCustomerShell
      ? 'customer-auth-shell'
      : 'wallet-auth-shell';
  const scrollClass = rentIntent
    ? 'rent-auth-scroll'
    : useCustomerShell
      ? 'customer-auth-scroll'
      : 'wallet-auth-scroll';
  const panelClass = rentIntent
    ? 'rent-auth-card'
    : useCustomerShell
      ? 'customer-auth-card'
      : 'wallet-auth-card';
  const iconClass = rentIntent
    ? 'material-symbols-outlined rent-auth-icon'
    : useCustomerShell
      ? 'material-symbols-outlined customer-auth-icon'
      : 'material-symbols-outlined wallet-auth-icon';
  const leadClass = rentIntent
    ? 'rent-auth-lead'
    : useCustomerShell
      ? 'customer-auth-lead'
      : 'wallet-auth-lead';
  const linkClass = rentIntent
    ? 'rent-auth-link'
    : useCustomerShell
      ? 'customer-auth-link'
      : 'wallet-auth-link';
  const submitClass = rentIntent
    ? 'rent-auth-submit'
    : useCustomerShell
      ? 'customer-auth-submit'
      : 'wallet-auth-submit';
  const dividerClass = rentIntent
    ? 'rent-auth-divider'
    : useCustomerShell
      ? 'customer-auth-divider'
      : 'wallet-auth-divider';
  const heroClass = rentIntent
    ? 'mb-8'
    : useCustomerShell
      ? 'customer-auth-hero'
      : 'wallet-auth-hero';

  return (
    <div className={shellClass}>
      <div className={cardClass}>
        <div className={scrollClass}>
          <div className={panelClass}>
        <div className={`text-center ${heroClass}`}>
          <span className={iconClass} aria-hidden>
            {rentIntent
              ? 'directions_car'
              : walletClaimFlow
                ? 'account_balance_wallet'
                : 'account_circle'}
          </span>
          <h1>
            {rentIntent
              ? 'Rent Wallet'
              : walletClaimFlow
                ? 'My Wallet'
                : 'Δημιουργία λογαριασμού'}
          </h1>
          {rentIntent ? (
            <p className={leadClass}>Δημιουργήστε λογαριασμό για ενοικίαση οχήματος</p>
          ) : walletClaimFlow ? null : (
            <p className={leadClass}>
              Όνομα, email και κωδικός — για κρατήσεις στο όνομά σας.
            </p>
          )}
        </div>

        {walletClaimFlow ? (
          <div className="mb-6 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-on-surface">
            <p className="font-bold text-primary mb-1">Η κράτησή σας είναι έτοιμη</p>
            <p className="text-on-surface-variant">
              Email: <span className="font-semibold text-on-surface">{prefillEmail}</span>
              {claim.reference || highlightBooking ? (
                <>
                  {' · '}
                  Κωδικός:{' '}
                  <span className="font-semibold text-on-surface">
                    {claim.reference || highlightBooking}
                  </span>
                </>
              ) : null}
            </p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5">
          {backendOk === false && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              {import.meta.env.PROD
                ? 'Η σύνδεση με τον server απέτυχε. Ανανεώστε τη σελίδα ή δοκιμάστε σε λίγο.'
                : (
                  <>
                    Ο server δεν τρέχει. Ανοίξτε νέο terminal και εκτελέστε:{' '}
                    <code className="text-xs bg-white px-1 rounded">npm run dev:backend</code>
                  </>
                )}
            </p>
          )}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {error}{' '}
              {error.includes('σύνδεση') ? (
                <Link
                  to={rentIntent ? '/rent/login' : '/login'}
                  state={loginState}
                  className="font-bold underline"
                >
                  Σύνδεση
                </Link>
              ) : null}
            </p>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-bold" htmlFor="name">
              Ονοματεπώνυμο <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              minLength={2}
              autoComplete="name"
              defaultValue={prefillName}
              className="w-full px-4 py-3.5 bg-surface-container-low rounded-2xl focus:ring-2 focus:ring-primary-container"
              placeholder="π.χ. Μαρία Παπαδοπούλου"
            />
            {walletClaimFlow ? (
              <p className="text-xs text-on-surface-variant">
                Το όνομα του επιβάτη για το εισιτήριο στο My Wallet.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              defaultValue={prefillEmail}
              className="w-full px-4 py-3.5 bg-surface-container-low rounded-2xl focus:ring-2 focus:ring-primary-container"
              placeholder="email@example.com"
            />
          </div>

          <PasswordField
            id="password"
            name="password"
            label="Κωδικός"
            minLength={6}
            required
            autoComplete="new-password"
          />

          <PasswordField
            id="confirm"
            name="confirm"
            label="Επιβεβαίωση κωδικού"
            minLength={6}
            required
            autoComplete="new-password"
          />

          <button type="submit" disabled={loading || googleLoading} className={submitClass}>
            {loading
              ? 'Δημιουργία…'
              : rentIntent
                ? 'Δημιουργία & είσοδος στην Ενοικίαση'
                : walletClaimFlow
                  ? 'Δημιουργία & άνοιγμα Wallet'
                  : 'Δημιουργία λογαριασμού'}
          </button>
        </form>

        <div className={`${dividerClass} mt-5`}>ή με Google</div>
        <div className="space-y-3 mt-2">
          <GoogleSignInButton
            text="signup_with"
            disabled={googleLoading || loading}
            onSuccess={handleGoogleCredential}
            onDemoProfile={handleGoogleDemo}
            onError={setError}
          />
          {googleLoading ? (
            <p className="text-xs text-center text-[#6e6e73]">Επαλήθευση Google…</p>
          ) : null}
        </div>

        <p className="text-sm text-center mt-6 text-[#6e6e73]">
          Έχετε ήδη λογαριασμό;{' '}
          <Link to={rentIntent ? '/rent/login' : '/login'} state={loginState} className={linkClass}>
            Σύνδεση
          </Link>
        </p>
        {!isNativeApp() ? (
          !rentIntent && !cleanRegister ? (
            <p className="text-xs text-center mt-4">
              <Link to="/my-booking" className={linkClass}>
                Εύρεση κράτησης λεωφορείου
              </Link>
            </p>
          ) : rentIntent ? (
            <p className="text-xs text-center mt-4">
              <Link to="/rent/my-booking" className={linkClass}>
                Εύρεση κράτησης ενοικίασης
              </Link>
            </p>
          ) : (
            <p className="text-xs text-center mt-4">
              <Link to="/" className={linkClass}>
                Επιστροφή στην αρχική
              </Link>
            </p>
          )
        ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
