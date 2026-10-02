import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetDriverPassword } from '../../services/driverPortalApi.js';
import '../../styles/driver-app.css';

/** Confirm new driver password from emailed reset link. */
export default function DriverResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => String(params.get('token') || '').trim(), [params]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('Λείπει ο σύνδεσμος επαναφοράς');
      return;
    }
    if (password.length < 4) {
      setError('Ο κωδικός πρέπει να έχει τουλάχιστον 4 χαρακτήρες');
      return;
    }
    if (password !== confirm) {
      setError('Οι κωδικοί δεν ταιριάζουν');
      return;
    }
    setLoading(true);
    try {
      await resetDriverPassword(token, password);
      setDone(true);
      window.setTimeout(() => navigate('/driver', { replace: true }), 1600);
    } catch (err) {
      setError(err.message || 'Αποτυχία επαναφοράς κωδικού');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="driver-gate is-phone is-portrait" data-gate-mode="forgot">
      <div className="driver-gate-glow driver-gate-glow--tr" aria-hidden />
      <div className="driver-gate-glow driver-gate-glow--bl" aria-hidden />
      <div className="driver-gate-panel">
        <header className="driver-gate-brand text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl driver-brand-icon mb-4">
            <span
              className="material-symbols-outlined text-[36px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              lock_reset
            </span>
          </div>
          <p className="driver-header-kicker mb-1" style={{ color: 'var(--driver-muted)' }}>
            PoreiaGo · Οδηγός
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--driver-text)' }}>
            Νέος κωδικός
          </h1>
          <p
            className="driver-gate-brand-sub text-sm mt-2 leading-relaxed max-w-xs mx-auto"
            style={{ color: 'var(--driver-muted)' }}
          >
            Ορίστε νέο κωδικό για την είσοδο βάρδιας
          </p>
        </header>

        <div className="driver-gate-card space-y-4">
          {!token ? (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center font-medium">
              Μη έγκυρος σύνδεσμος. Ζητήστε νέο από την είσοδο οδηγού.
            </p>
          ) : done ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 font-medium">
                Ο κωδικός ενημερώθηκε. Μεταφορά στην είσοδο…
              </p>
              <Link to="/driver" className="driver-gate-secondary inline-flex justify-center">
                Είσοδος βάρδιας
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="block">
                <span className="driver-gate-label">Νέος κωδικός</span>
                <div className="driver-gate-password-wrap">
                  <input
                    className="driver-gate-input driver-gate-input--with-eye"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="τουλάχιστον 4 χαρακτήρες"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={4}
                  />
                  <button
                    type="button"
                    className="driver-gate-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
                    aria-pressed={showPassword}
                  >
                    <span className="material-symbols-outlined text-[22px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </label>
              <label className="block">
                <span className="driver-gate-label">Επιβεβαίωση</span>
                <input
                  className="driver-gate-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="επαναλάβετε τον κωδικό"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  disabled={loading}
                  minLength={4}
                />
              </label>
              <button
                type="submit"
                className="driver-gate-submit"
                disabled={loading || !password || !confirm}
              >
                {loading ? 'Αποθήκευση…' : 'Αποθήκευση κωδικού'}
              </button>
              <Link to="/driver" className="driver-gate-secondary inline-flex justify-center">
                Πίσω στην είσοδο
              </Link>
            </form>
          )}

          {error ? (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center font-medium">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
