import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { isNativeApp } from '../../lib/capacitor/isNativeApp.js';
import {
  isNativeDriverApp,
  markNativeAppShell,
  NATIVE_APP_DRIVER,
} from '../../lib/capacitor/nativeAppId.js';

/**
 * Capacitor Driver app — command center only.
 * Blocks marketing home, wallet, admin, rent browse.
 */
export function isDriverAppPath(pathname) {
  const p = pathname || '/';
  return p === '/driver' || p.startsWith('/driver/');
}

export default function DriverNativeBoot() {
  const location = useLocation();
  const navigate = useNavigate();
  const nativeDriver = isNativeApp() && isNativeDriverApp();

  useEffect(() => {
    if (!nativeDriver) return;
    markNativeAppShell(NATIVE_APP_DRIVER);
    return () => {
      try {
        if (document.documentElement.dataset.poreiagoApp === NATIVE_APP_DRIVER) {
          delete document.documentElement.dataset.poreiagoApp;
        }
      } catch {
        /* ignore */
      }
    };
  }, [nativeDriver]);

  useEffect(() => {
    if (!nativeDriver) return;
    const path = location.pathname || '/';
    if (isDriverAppPath(path)) return;
    navigate('/driver', { replace: true });
  }, [nativeDriver, location.pathname, navigate]);

  if (nativeDriver && !isDriverAppPath(location.pathname)) {
    return <Navigate to="/driver" replace />;
  }

  return null;
}
