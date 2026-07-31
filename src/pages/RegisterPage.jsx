import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { loginAsCustomer } from '../lib/auth.js';
import { registerCustomer, isCustomerAuthBackendAvailable } from '../services/customerAuthApi.js';
import PasswordField from '../components/PasswordField.jsx';
import {
  clearWalletClaim,
  getWalletClaim,
  walletClaimNavState,
  walletHomeNavState,
} from '../lib/wallet/walletClaim.js';
import { useRentMobile, useRentPhone } from '../lib/rental/rentDevice.js';
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

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useRentMobile();
  const isPhone = useRentPhone();
  const pathRent = isRentAuthPath(location.pathname);
  const redirectTo = pathRent
    ? isRentReturn(location.state?.from)
      ? location.state.from
      : '/rent/wallet'
    : location.state?.from || '/wallet';
  const rentIntent = pathRent || isRentReturn(redirectTo);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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

  const prefillEmail = claim?.email || '';
  const prefillName = claim?.name || '';
  const highlightBooking = claim?.bookingId || location.state?.highlightBooking;

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
      const hadClaim = Boolean(claim);
      clearWalletClaim();
      if (rentIntent) {
        navigate(redirectTo, { replace: true });
      } else {
        navigate(redirectTo === '/wallet' || redirectTo.startsWith('/wallet') ? redirectTo : '/wallet', {
          replace: true,
          state: walletHomeNavState({
            highlightBooking,
            fromClaim: hadClaim,
          }),
        });
      }
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
      : { from: redirectTo };

  const shellClass = rentIntent
    ? `rent-auth-stage${isPhone ? '' : ' rent-auth-stage--desktop'}`
    : `wallet-auth-stage${isMobile ? '' : ' wallet-auth-stage--desktop'}`;
  const cardClass = rentIntent ? 'rent-auth-shell' : 'wallet-auth-shell';
  const scrollClass = rentIntent ? 'rent-auth-scroll' : 'wallet-auth-scroll';
  const panelClass = rentIntent ? 'rent-auth-card' : 'wallet-auth-card';
  const iconClass = rentIntent
    ? 'material-symbols-outlined rent-auth-icon'
    : 'material-symbols-outlined wallet-auth-icon';
  const leadClass = rentIntent ? 'rent-auth-lead' : 'wallet-auth-lead';
  const hintClass = rentIntent ? 'rent-auth-hint' : 'wallet-auth-hint';
  const linkClass = rentIntent ? 'rent-auth-link' : 'wallet-auth-link';
  const submitClass = rentIntent ? 'rent-auth-submit' : 'wallet-auth-submit';

  return (
    <div className={shellClass}>
      <div className={cardClass}>
        <div className={scrollClass}>
          <div className={panelClass}>
        <div className="text-center mb-8">
          <span className={iconClass}>
            {rentIntent ? 'directions_car' : 'account_balance_wallet'}
          </span>
          <h1>
            {rentIntent
              ? 'Rent Wallet'
              : claim
                ? 'Αποθήκευση στο My Wallet'
                : 'Εγγραφή My Wallet'}
          </h1>
          <p className={leadClass}>
            {rentIntent
              ? 'Δημιουργήστε λογαριασμό για ενοικίαση οχήματος — ξεχωριστά από τα λεωφορεία.'
              : claim
                ? 'Δημιουργήστε λογαριασμό για να δείτε το εισιτήριο και το QR επιβίβασης'
                : 'Δημιουργήστε λογαριασμό μόνο για ταξίδια με λεωφορείο'}
          </p>
          <p className={hintClass}>
            {rentIntent ? (
              <>
                Τα λεωφορεία είναι στο{' '}
                <Link to="/login" className={linkClass}>
                  My Wallet
                </Link>{' '}
                (μπλε, /login).
              </>
            ) : (
              <>
                Η ενοικίαση είναι στο{' '}
                <Link to="/rent/login" className={linkClass}>
                  Rent Wallet
                </Link>{' '}
                (πράσινο, /rent/login).
              </>
            )}
          </p>
        </div>

        {claim && !rentIntent ? (
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
              Ονοματεπώνυμο
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={prefillName}
              className="w-full px-4 py-3.5 bg-surface-container-low rounded-2xl focus:ring-2 focus:ring-primary-container"
              placeholder="Γιώργος Π."
            />
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

          <button type="submit" disabled={loading} className={submitClass}>
            {loading
              ? 'Δημιουργία…'
              : rentIntent
                ? 'Δημιουργία & είσοδος στην Ενοικίαση'
                : claim
                  ? 'Δημιουργία & άνοιγμα Wallet'
                  : 'Δημιουργία λογαριασμού'}
          </button>
        </form>

        <p className="text-sm text-center mt-6 text-[#6e6e73]">
          Έχετε ήδη λογαριασμό;{' '}
          <Link to={rentIntent ? '/rent/login' : '/login'} state={loginState} className={linkClass}>
            Σύνδεση
          </Link>
        </p>
        {!rentIntent ? (
          <p className="text-xs text-center mt-4">
            <Link to="/my-booking" className={linkClass}>
              Εύρεση κράτησης χωρίς λογαριασμό
            </Link>
          </p>
        ) : (
          <p className="text-xs text-center mt-4">
            <Link to="/rent/my-booking" className={linkClass}>
              Εύρεση κράτησης ενοικίασης
            </Link>
          </p>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
