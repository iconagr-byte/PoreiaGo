import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { fetchPlatformSettings } from '../services/platformApi.js';
import AchillioLogo from './AchillioLogo.jsx';

const BYPASS_PREFIXES = ['/admin', '/driver', '/wallet', '/login', '/my-booking', '/ticket'];

/**
 * Blocks B2C routes when platform maintenance_mode is on.
 */
export default function MaintenanceGate({ children }) {
  const location = useLocation();
  const [maintenance, setMaintenance] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchPlatformSettings()
      .then((s) => setMaintenance(Boolean(s.maintenance_mode)))
      .catch(() => setMaintenance(false))
      .finally(() => setLoaded(true));
  }, []);

  const bypass = BYPASS_PREFIXES.some((p) => location.pathname.startsWith(p));

  if (maintenance && loaded && !bypass) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 text-center">
        <AchillioLogo className="h-12 mb-8" />
        <span className="material-symbols-outlined text-5xl text-amber-500 mb-4">construction</span>
        <h1 className="text-2xl font-bold text-on-surface mb-2">Συντήρηση πλατφόρμας</h1>
        <p className="text-on-surface-variant max-w-md mb-8">
          Οι online κρατήσεις είναι προσωρινά μη διαθέσιμες. Δοκιμάστε ξανά σύντομα ή επικοινωνήστε μαζί
          μας.
        </p>
        <Link
          to="/admin/login"
          className="text-primary font-bold text-sm hover:underline"
        >
          Admin Login
        </Link>
      </div>
    );
  }

  return children;
}
