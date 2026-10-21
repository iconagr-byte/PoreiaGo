/**
 * In-page login dialog for storefront / checkout — so bookings attach to a real account.
 * Portaled to document.body so fixed header / backdrop-filter cannot clip it.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { loginAsCustomer } from '../../lib/auth.js';
import GoogleSignInButton from '../GoogleSignInButton.jsx';
import {
  isCustomerAuthBackendAvailable,
  loginCustomer,
  verifyGoogleLogin,
} from '../../services/customerAuthApi.js';
import '../../styles/customer-login-modal.css';

export default function CustomerLoginModal({
  open,
  onClose,
  onSuccess,
  title = 'Log in to your account',
  lead = 'Συνδεθείτε για να γνωρίζει το σύστημα ποιος κάνει την κράτηση — το εισιτήριο μπαίνει στο My Wallet σας.',
  /** After signup, return here (storefront home / checkout). Not My Wallet claim. */
  registerFrom = '/',
  prefillEmail = '',
}) {
  const titleId = useId();
  const emailRef = useRef(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [backendOk, setBackendOk] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return undefined;
    }
    setError('');
    setLoading(false);
    setGoogleLoading(false);
    setEntered(false);
    isCustomerAuthBackendAvailable().then(setBackendOk);
    const enter = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setEntered(true));
    });
    const t = window.setTimeout(() => emailRef.current?.focus(), 280);
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.cancelAnimationFrame(enter);
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const finish = (email, profile = {}, accessToken = null) => {
    loginAsCustomer(email, profile, accessToken);
    onSuccess?.({
      email,
      name: profile.name || '',
      phone: profile.phone || '',
      picture: profile.picture || '',
      provider: profile.provider || 'email',
      tenant_id: profile.tenant_id,
    });
    onClose?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const email = e.target.email.value.trim().toLowerCase();
    const password = e.target.password.value;
    if (!password.trim()) {
      setError('Εισάγετε κωδικό πρόσβασης.');
      return;
    }
    setLoading(true);
    try {
      const result = await loginCustomer({ email, password });
      finish(
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
      );
    } catch (err) {
      setError(err.message || 'Αποτυχία σύνδεσης');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (credential) => {
    setError('');
    setGoogleLoading(true);
    try {
      const profile = await verifyGoogleLogin(credential);
      finish(
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
      setError(err?.message || 'Αποτυχία σύνδεσης με Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  const node = (
    <div
      className={`cust-login-modal${entered ? ' is-open' : ''}`}
      role="presentation"
    >
      <button
        type="button"
        className="cust-login-modal-backdrop"
        aria-label="Κλείσιμο"
        onClick={onClose}
      />
      <div
        className="cust-login-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button
          type="button"
          className="cust-login-modal-close"
          onClick={onClose}
          aria-label="Κλείσιμο"
        >
          <span className="material-symbols-outlined" aria-hidden>
            close
          </span>
        </button>

        <div className="cust-login-modal-hero">
          <span className="material-symbols-outlined cust-login-modal-icon" aria-hidden>
            account_circle
          </span>
          <h2 id={titleId}>{title}</h2>
          <p>{lead}</p>
        </div>

        <form onSubmit={handleSubmit} className="cust-login-modal-form">
          {backendOk === false ? (
            <p className="cust-login-modal-banner cust-login-modal-banner--warn">
              Η σύνδεση με τον server απέτυχε. Ανανεώστε τη σελίδα ή δοκιμάστε σε λίγο.
            </p>
          ) : null}
          {error ? (
            <p className="cust-login-modal-banner cust-login-modal-banner--err">{error}</p>
          ) : null}

          <label className="cust-login-modal-field">
            <span>Email</span>
            <input
              ref={emailRef}
              name="email"
              type="email"
              defaultValue={prefillEmail}
              autoComplete="email"
              required
              placeholder="email@example.com"
            />
          </label>

          <label className="cust-login-modal-field">
            <span>Κωδικός</span>
            <div className="cust-login-modal-pass">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
              <button
                type="button"
                className="cust-login-modal-eye"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
              >
                <span className="material-symbols-outlined" aria-hidden>
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </label>

          <button
            type="submit"
            className="cust-login-modal-submit"
            disabled={loading || googleLoading}
          >
            {loading ? 'Σύνδεση…' : 'Log in to your account'}
          </button>
        </form>

        <div className="cust-login-modal-divider">
          <span>ή</span>
        </div>

        <div className="cust-login-modal-google">
          <GoogleSignInButton
            onSuccess={handleGoogle}
            onError={(msg) => setError(msg || 'Αποτυχία Google')}
            disabled={loading || googleLoading}
            text="signin_with"
          />
        </div>

        <p className="cust-login-modal-footer">
          Δεν έχετε λογαριασμό;{' '}
          <Link
            to="/register"
            state={{ from: registerFrom || '/', cleanRegister: true }}
            onClick={onClose}
          >
            Εγγραφή
          </Link>
        </p>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
