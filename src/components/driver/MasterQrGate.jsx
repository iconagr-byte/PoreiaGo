import { useEffect, useState } from 'react';
import { exchangeMasterQr, loginDriver } from '../../services/driverPortalApi.js';
import { clearDriverShiftLaunchState } from '../../lib/driver/useDriverShiftSession.js';
import { useDriverDeviceForm } from '../../hooks/useDriverDeviceForm.js';
import BusQrScanner from '../BusQrScanner.jsx';
import '../../styles/driver-app.css';

export default function MasterQrGate({ onAuthenticated }) {
  const [mode, setMode] = useState('password'); // password | qr
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const device = useDriverDeviceForm();
  const deviceClass = [
    device.isTablet ? 'is-tablet' : 'is-phone',
    device.isLandscape ? 'is-landscape' : 'is-portrait',
  ].join(' ');

  useEffect(() => {
    document.documentElement.classList.add('driver-route');
    const viewport = document.querySelector('meta[name="viewport"]');
    const prevContent = viewport?.getAttribute('content') || '';
    if (viewport) {
      viewport.setAttribute(
        'content',
        'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1',
      );
    }
    return () => {
      document.documentElement.classList.remove('driver-route');
      if (viewport && prevContent) {
        viewport.setAttribute('content', prevContent);
      }
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await loginDriver(username.trim(), password);
      // Login ≠ shift start — GPS/tachograph wait for «Έναρξη βάρδιας».
      clearDriverShiftLaunchState();
      onAuthenticated(session);
    } catch (err) {
      setError(err.message || 'Αποτυχία σύνδεσης');
    } finally {
      setLoading(false);
    }
  };

  const handleRaw = async (raw) => {
    setError('');
    setLoading(true);
    try {
      const session = await exchangeMasterQr(raw);
      clearDriverShiftLaunchState();
      onAuthenticated(session);
    } catch (err) {
      setError(err.message || 'Αποτυχία σύνδεσης');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`driver-gate ${deviceClass}`}
      data-device-form={device.form}
      data-orientation={device.orientation}
      data-gate-mode={mode}
    >
      <div className="driver-gate-glow driver-gate-glow--tr" aria-hidden />
      <div className="driver-gate-glow driver-gate-glow--bl" aria-hidden />

      <div className="driver-gate-panel">
        <header className="driver-gate-brand text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl driver-brand-icon mb-4">
            <span
              className="material-symbols-outlined text-[36px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {mode === 'password' ? 'badge' : 'qr_code_scanner'}
            </span>
          </div>
          <p className="driver-header-kicker mb-1" style={{ color: 'var(--driver-muted)' }}>
            PoreiaGo · Οδηγός
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--driver-text)' }}>
            {mode === 'password' ? 'Καλωσήρθατε' : 'Σάρωση QR'}
          </h1>
          <p
            className="driver-gate-brand-sub text-sm mt-2 leading-relaxed max-w-xs mx-auto"
            style={{ color: 'var(--driver-muted)' }}
          >
            {mode === 'password' ? (
              <>Συνδεθείτε για να ξεκινήσετε τη βάρδια σας</>
            ) : (
              <>
                Σκανάρετε το <span className="font-bold" style={{ color: 'var(--driver-accent)' }}>Master QR</span>{' '}
                στο ταμπλό του λεωφορείου
              </>
            )}
          </p>

          <div className="driver-gate-brand-extras">
            <p className="driver-gate-lead">
              Η εφαρμογή οδηγού για εκδρομές — GPS, επιβίβαση και επικοινωνία με το γραφείο σε ένα μέρος.
            </p>
            <ul className="driver-gate-features">
              <li>
                <span className="material-symbols-outlined" aria-hidden>
                  my_location
                </span>
                Ζωντανή θέση στον χάρτη μετά την έναρξη βάρδιας
              </li>
              <li>
                <span className="material-symbols-outlined" aria-hidden>
                  qr_code_scanner
                </span>
                Σάρωση εισιτηρίων & λίστα επιβατών
              </li>
              <li>
                <span className="material-symbols-outlined" aria-hidden>
                  chat
                </span>
                Μηνύματα & ειδοποιήσεις από το γραφείο
              </li>
            </ul>
            <p className="driver-gate-footnote">
              Η σύνδεση δεν ξεκινά αυτόματα τη βάρδια — μετά την είσοδο πατήστε «Έναρξη βάρδιας».
            </p>
          </div>
        </header>

        <div className="driver-gate-card space-y-4">
          {mode === 'password' ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <label className="block">
                <span className="driver-gate-label">Όνομα χρήστη</span>
                <input
                  className="driver-gate-input"
                  type="text"
                  autoComplete="username"
                  inputMode="email"
                  placeholder="email ή κωδικός άδειας"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={loading}
                />
              </label>
              <label className="block">
                <span className="driver-gate-label">Κωδικός</span>
                <div className="driver-gate-password-wrap">
                  <input
                    className="driver-gate-input driver-gate-input--with-eye"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="driver-gate-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
                    aria-pressed={showPassword}
                    tabIndex={0}
                  >
                    <span className="material-symbols-outlined text-[22px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </label>
              <button type="submit" className="driver-gate-submit" disabled={loading || !username || !password}>
                {loading ? 'Σύνδεση…' : 'Είσοδος'}
              </button>
              <button
                type="button"
                className="driver-gate-secondary"
                disabled={loading}
                onClick={() => {
                  setError('');
                  setMode('qr');
                }}
              >
                Γρήγορη είσοδος με QR
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <BusQrScanner
                variant="light"
                compact
                paused={loading}
                quietCamera
                onScan={handleRaw}
              />
              <button
                type="button"
                className="driver-gate-secondary"
                disabled={loading}
                onClick={() => {
                  setError('');
                  setMode('password');
                }}
              >
                Επιστροφή σε όνομα / κωδικό
              </button>
            </div>
          )}

          {loading && (
            <p
              className="text-center text-sm font-bold flex items-center justify-center gap-2"
              style={{ color: 'var(--driver-accent)' }}
            >
              <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
              Σύνδεση…
            </p>
          )}

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center font-medium">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
