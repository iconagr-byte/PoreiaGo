import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exchangeMasterQr } from '../../services/driverPortalApi.js';

/**
 * Magic-link receiver — /driver/auth?token=…
 * Zero-friction login after scanning dashboard QR (opens URL on phone).
 */
export default function DriverAuthPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

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
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      {error ? (
        <div className="max-w-sm text-center space-y-4">
          <span className="material-symbols-outlined text-5xl text-rose-400">error</span>
          <p className="text-lg font-bold text-rose-300">{error}</p>
          <p className="text-sm text-neutral-400">
            Please scan the QR code in your bus to start.
          </p>
          <a href="/driver" className="inline-block text-[#facc15] font-bold underline">
            Δοκιμή με κάμερα
          </a>
        </div>
      ) : (
        <div className="text-center space-y-4">
          <span
            className="material-symbols-outlined text-6xl text-[#facc15] animate-spin"
            style={{ animationDuration: '1.2s' }}
          >
            progress_activity
          </span>
          <p className="text-xl font-bold">Σύνδεση στη βάρδια…</p>
          <p className="text-sm text-neutral-400">Θα μεταφερθείτε αυτόματα στην εφαρμογή οδηγού</p>
        </div>
      )}
    </div>
  );
}
