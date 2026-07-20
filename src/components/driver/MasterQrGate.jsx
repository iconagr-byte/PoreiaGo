import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { exchangeMasterQr, loginDriver } from '../../services/driverPortalApi.js';
import BusQrScanner from '../BusQrScanner.jsx';
import '../../styles/driver-app.css';

export default function MasterQrGate({ onAuthenticated }) {
  const [mode, setMode] = useState('password'); // password | qr
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      onAuthenticated(session);
    } catch (err) {
      setError(err.message || 'Αποτυχία σύνδεσης');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="driver-gate">
      <div className="driver-gate-glow driver-gate-glow--tr" aria-hidden />
      <div className="driver-gate-glow driver-gate-glow--bl" aria-hidden />

      <div className="driver-gate-panel">
        <div className="text-center mb-6">
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
            {mode === 'password' ? 'Είσοδος βάρδιας' : 'Master QR'}
          </h1>
          <p
            className="text-sm mt-2 leading-relaxed max-w-xs mx-auto"
            style={{ color: 'var(--driver-muted)' }}
          >
            {mode === 'password' ? (
              <>Συνδεθείτε με όνομα χρήστη και κωδικό</>
            ) : (
              <>
                Σκανάρετε το <span className="font-bold" style={{ color: 'var(--driver-accent)' }}>Master QR</span>{' '}
                στο ταμπλό του λεωφορείου
              </>
            )}
          </p>
        </div>

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
                <input
                  className="driver-gate-input"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
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

          {loading && mode === 'qr' && (
            <p
              className="text-center text-sm font-bold flex items-center justify-center gap-2"
              style={{ color: 'var(--driver-accent)' }}
            >
              <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
              Σύνδεση στη βάρδια…
            </p>
          )}

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center font-medium">
              {error}
            </p>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--driver-muted)' }}>
          <Link to="/admin/login" className="font-bold hover:underline" style={{ color: 'var(--driver-accent)' }}>
            Επιστροφή στη σύνδεση
          </Link>
        </p>
      </div>
    </div>
  );
}
