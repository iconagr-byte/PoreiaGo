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
import '../styles/wallet-pass.css';

function isRentReturn(path) {
  return typeof path === 'string' && (path === '/rent' || path.startsWith('/rent/'));
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/wallet';
  const rentIntent = isRentReturn(redirectTo);
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
    ? 'min-h-screen bg-surface flex flex-col items-center justify-center px-4'
    : 'wallet-auth-stage';
  const cardClass = rentIntent
    ? 'bg-surface-container-lowest p-10 md:p-14 rounded-[32px] shadow-level-2 w-full max-w-md'
    : 'wallet-auth-shell';

  return (
    <div className={shellClass}>
      <div className={cardClass}>
        <div className={rentIntent ? undefined : 'wallet-auth-scroll'}>
          <div className={rentIntent ? undefined : 'wallet-auth-card'}>
        <div className="text-center mb-8">
          <span
            className={
              rentIntent
                ? 'material-symbols-outlined text-4xl text-primary mb-3'
                : 'material-symbols-outlined wallet-auth-icon'
            }
          >
            {rentIntent ? 'directions_car' : 'account_balance_wallet'}
          </span>
          <h1 className={rentIntent ? 'text-2xl font-bold text-on-surface' : undefined}>
            {rentIntent
              ? 'Λογαριασμός ενοικίασης'
              : claim
                ? 'Αποθήκευση στο My Wallet'
                : 'Εγγραφή My Wallet'}
          </h1>
          <p className={rentIntent ? 'text-sm text-on-surface-variant mt-2' : 'wallet-auth-lead'}>
            {rentIntent
              ? 'Δημιουργήστε λογαριασμό για να κλείσετε όχημα. Μετά την εγγραφή μπαίνετε στην εφαρμογή ενοικίασης.'
              : claim
                ? 'Δημιουργήστε λογαριασμό για να δείτε το εισιτήριο και το QR επιβίβασης'
                : 'Δημιουργήστε λογαριασμό για ταξίδια με λεωφορείο'}
          </p>
          {rentIntent ? (
            <p className="text-xs text-on-surface-variant mt-2">
              Τα λεωφορεία / εισιτήρια είναι στο My Wallet — εδώ είναι μόνο η ενοικίαση.
            </p>
          ) : (
            <p className="wallet-auth-hint">Η ενοικίαση οχήματος είναι στην εφαρμογή Rent (teal).</p>
          )}
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
                <Link to="/login" state={loginState} className="font-bold underline">
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

          <button
            type="submit"
            disabled={loading}
            className={
              rentIntent
                ? 'w-full py-4 rounded-full bg-primary-container text-white font-bold disabled:opacity-60'
                : 'wallet-auth-submit'
            }
          >
            {loading
              ? 'Δημιουργία…'
              : rentIntent
                ? 'Δημιουργία & είσοδος στην Ενοικίαση'
                : claim
                  ? 'Δημιουργία & άνοιγμα Wallet'
                  : 'Δημιουργία λογαριασμού'}
          </button>
        </form>

        <p className={`text-sm text-center mt-6 ${rentIntent ? 'text-gray-600' : 'text-[#6e6e73]'}`}>
          Έχετε ήδη λογαριασμό;{' '}
          <Link
            to="/login"
            state={loginState}
            className={rentIntent ? 'text-primary font-bold hover:underline' : 'wallet-auth-link'}
          >
            Σύνδεση
          </Link>
        </p>
        {!rentIntent ? (
          <p className="text-xs text-center mt-4">
            <Link to="/my-booking" className="wallet-auth-link">
              Εύρεση κράτησης χωρίς λογαριασμό
            </Link>
          </p>
        ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
