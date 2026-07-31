import { useMemo, useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
  getCustomerEmail,
  getCustomerToken,
  isCustomer,
  loginAsCustomer,
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
import { useRentPhone } from '../lib/rental/rentDevice.js';
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
  const { enabled: googleEnabled } = useGoogleAuthConfig();
  // Path / prop wins over shared /login — rent entrance must never look like bus My Wallet.
  const pathRent = rentEntrance || isRentAuthPath(location.pathname);
  const bookingPayContinue =
    typeof location.state?.from === 'string' &&
    (location.state.from.includes('/rent/book/payment') || location.state?.rentBookingPay);
  const redirectTo = pathRent
    ? isRentReturn(location.state?.from)
      ? location.state.from
      : '/rent/wallet'
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
    // Bus /login must never host rent — send rent deep-links to green /rent/login.
    if (
      location.pathname === '/login' &&
      isRentReturn(location.state?.from)
    ) {
      navigate('/rent/login', { replace: true, state: location.state });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (isCustomer() && getCustomerToken()) {
      navigate(redirectTo, { replace: true });
      return;
    }
    // /login and /rent/login are customer wallets — never bounce leftover office
    // admin sessions into Back Office (that dumped www.poreiago.com visitors).
    if (rentIntent || walletIntent) return;
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
    const rentLookupState = rentIntent
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
      redirectTo === '/wallet' || redirectTo.startsWith('/wallet')
        ? homeState
        : rentIntent
          ? rentLookupState
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
        <h1>
          {bookingPayContinue ? 'Ολοκλήρωση πληρωμής' : rentIntent ? 'Rent Wallet' : 'My Wallet'}
        </h1>
        <p className={leadClass}>
          {bookingPayContinue
            ? 'Συνδεθείτε για να ολοκληρώσετε την κράτηση και την πληρωμή — θα επιστρέψετε στη σελίδα πληρωμής.'
            : rentIntent
              ? 'Σύνδεση για ενοικίαση οχήματος — ξεχωριστή εφαρμογή από τα λεωφορεία.'
              : claim
                ? 'Συνδεθείτε για να δείτε το εισιτήριο της κράτησής σας'
                : 'Σύνδεση μόνο για ταξίδια με λεωφορείο — εισιτήρια & QR επιβίβασης'}
        </p>
        <p className={hintClass}>
          {rentIntent ? (
            <>
              Τα λεωφορεία είναι στο{' '}
              <Link to="/login" className={linkClass}>
                My Wallet
              </Link>{' '}
              (μπλε) — διεύθυνση <span className="font-mono text-[0.85em]">/login</span>.
            </>
          ) : (
            <>
              Η ενοικίαση είναι στο{' '}
              <Link to="/rent/login" className={linkClass}>
                Rent Wallet
              </Link>{' '}
              (πράσινο) — διεύθυνση <span className="font-mono text-[0.85em]">/rent/login</span>.
            </>
          )}
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
          state={rentIntent ? { from: '/rent/wallet' } : registerState}
          className={linkClass}
        >
          {rentIntent ? 'Δημιουργία λογαριασμού' : 'Εγγραφή'}
        </Link>
      </p>
      {!rentIntent ? (
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
      )}
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
                <p className="rent-auth-aside-note">
                  Μόνο ενοικιάσεις — <strong>/rent/login</strong> και <strong>/rent/wallet</strong>.
                  Λεωφορεία:{' '}
                  <Link to="/login" className="rent-auth-link rent-auth-link--on-dark">
                    My Wallet
                  </Link>{' '}
                  (μπλε, <strong>/login</strong>).
                </p>
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`wallet-auth-stage${isPhone ? '' : ' wallet-auth-stage--desktop'}`}>
      <div className="wallet-auth-shell">
        <div className="wallet-auth-scroll">
          {!isPhone ? (
            <aside className="wallet-auth-aside" aria-label="Σχετικά με το My Wallet λεωφορείων">
              <p className="wallet-auth-aside-kicker">My Wallet · Λεωφορεία</p>
              <h2 className="wallet-auth-aside-title">
                Τα εισιτήριά σας,<br />πάντα στο κινητό
              </h2>
              <p className="wallet-auth-aside-lead">
                Συνδεθείτε για να δείτε κρατήσεις λεωφορείου, QR επιβίβασης και ιστορικό ταξιδιών —
                σε έναν ασφαλή λογαριασμό στον server.
              </p>
              <ul className="wallet-auth-aside-list">
                <li>
                  <span className="material-symbols-outlined" aria-hidden>
                    qr_code_2
                  </span>
                  <div>
                    <strong>QR επιβίβασης</strong>
                    <span>Ανοίξτε το εισιτήριο χωρίς email ή PDF.</span>
                  </div>
                </li>
                <li>
                  <span className="material-symbols-outlined" aria-hidden>
                    confirmation_number
                  </span>
                  <div>
                    <strong>Όλες οι κρατήσεις</strong>
                    <span>Προσεχή και παλαιά ταξίδια σε μία λίστα.</span>
                  </div>
                </li>
                <li>
                  <span className="material-symbols-outlined" aria-hidden>
                    notifications_active
                  </span>
                  <div>
                    <strong>Ενημερώσεις διαδρομής</strong>
                    <span>Ειδοποιήσεις για αλλαγές και υπενθυμίσεις.</span>
                  </div>
                </li>
                <li>
                  <span className="material-symbols-outlined" aria-hidden>
                    lock
                  </span>
                  <div>
                    <strong>Ασφαλής λογαριασμός</strong>
                    <span>Τα δεδομένα μένουν στο γραφείο σας, όχι μόνο στη συσκευή.</span>
                  </div>
                </li>
              </ul>
              <p className="wallet-auth-aside-note">
                Μόνο λεωφορεία — διεύθυνση <strong>/login</strong> και <strong>/wallet</strong>.
                Ενοικίαση οχήματος:{' '}
                <Link to="/rent/login" className="wallet-auth-link">
                  Rent Wallet
                </Link>{' '}
                (πράσινο, <strong>/rent/login</strong>).
              </p>
            </aside>
          ) : null}
          <div className="wallet-auth-panel">
            <div className="wallet-auth-card">{formBody}</div>
            <Link to="/" className="wallet-auth-back">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Επιστροφή στην Αρχική
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
