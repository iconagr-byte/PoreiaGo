import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { exchangeMasterQr } from '../../services/driverPortalApi.js';
import BusQrScanner from '../BusQrScanner.jsx';
import '../../styles/driver-app.css';

export default function MasterQrGate({ onAuthenticated }) {
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

  const handleRaw = async (raw) => {
    setError('');
    setLoading(true);
    try {
      const session = await exchangeMasterQr(raw);
      onAuthenticated(session);
    } catch (e) {
      setError(e.message || 'Αποτυχία σύνδεσης');
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
              qr_code_scanner
            </span>
          </div>
          <p className="driver-header-kicker mb-1">PoreiaGo · Οδηγός</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Σύνδεση βάρδιας</h1>
          <p className="text-sm text-[var(--driver-muted)] mt-2 leading-relaxed max-w-xs mx-auto">
            Σκανάρετε το <span className="font-bold text-[var(--driver-yellow)]">Master QR</span> στο
            ταμπλό του λεωφορείου
          </p>
        </div>

        <div className="driver-gate-card space-y-4">
          <BusQrScanner
            variant="dark"
            compact
            paused={loading}
            quietCamera
            onScan={handleRaw}
          />

          {loading && (
            <p className="text-center text-sm font-bold text-[var(--driver-yellow)] flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
              Σύνδεση στη βάρδια…
            </p>
          )}

          {error && (
            <p className="text-sm text-red-300 bg-red-950/50 border border-red-500/30 rounded-xl px-4 py-3 text-center font-medium">
              {error}
            </p>
          )}
        </div>

        <p className="text-center text-xs text-[var(--driver-muted)] mt-6">
          <Link to="/admin/login" className="text-[var(--driver-yellow)] font-bold hover:underline">
            Επιστροφή στη σύνδεση
          </Link>
        </p>
      </div>
    </div>
  );
}
