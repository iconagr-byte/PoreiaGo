import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exchangeMasterQr } from '../../services/driverPortalApi.js';
import '../../styles/driver-app.css';

/**
 * Magic-link receiver — /driver/auth?token=…
 * Zero-friction login after scanning dashboard QR (opens URL on phone).
 */
export default function DriverAuthPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    document.documentElement.classList.add('driver-route');
    return () => document.documentElement.classList.remove('driver-route');
  }, []);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Σαρώστε το QR code στο λεωφορείο για να ξεκινήσετε.');
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        await exchangeMasterQr(token);
        if (!cancelled) {
          navigate('/driver', { replace: true });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Αποτυχία σύνδεσης. Το QR μπορεί να έληξε.');
        }
      }
    }, 1000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchParams, navigate]);

  return (
    <div className="driver-gate">
      {error ? (
        <div className="max-w-sm text-center space-y-4 relative z-10">
          <span className="material-symbols-outlined text-5xl text-rose-500">error</span>
          <p className="text-lg font-bold text-rose-600">{error}</p>
          <p className="text-sm" style={{ color: 'var(--driver-muted)' }}>
            Please scan the QR code in your bus to start.
          </p>
          <a href="/driver" className="inline-block font-bold underline" style={{ color: 'var(--driver-accent)' }}>
            Δοκιμή με κάμερα
          </a>
        </div>
      ) : (
        <div className="text-center space-y-4 relative z-10">
          <span
            className="material-symbols-outlined text-6xl animate-spin"
            style={{ animationDuration: '1.2s', color: 'var(--driver-accent)' }}
          >
            progress_activity
          </span>
          <p className="text-xl font-bold" style={{ color: 'var(--driver-text)' }}>
            Σύνδεση στη βάρδια…
          </p>
          <p className="text-sm" style={{ color: 'var(--driver-muted)' }}>
            Θα μεταφερθείτε αυτόματα στην εφαρμογή οδηγού
          </p>
        </div>
      )}
    </div>
  );
}
