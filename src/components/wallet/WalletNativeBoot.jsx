import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { isNativeApp, isNativeDriverApp } from '../../lib/capacitor/isNativeApp.js';

/**
 * Unified My Wallet (buses + rentals) — no marketing site / admin / driver.
 * Rent browse/book stays on office web; app shows sealed wallet passes only.
 */
const WALLET_APP_PREFIXES = [
  '/wallet',
  '/my-booking',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/ticket/',
  '/passenger-checkin',
  '/wallet/native-google',
];

export function isWalletAppPath(pathname) {
  const p = pathname || '/';
  return WALLET_APP_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix));
}

/**
 * Capacitor Wallet app: traveler My Wallet only.
 * Blocks marketing home, trip browse, admin, driver, rent.
 * Render-time Navigate so HomePage never paints on cold start.
 * Skipped entirely when the Driver native shell is active.
 */
export default function WalletNativeBoot() {
  const location = useLocation();
  const navigate = useNavigate();
  const native = isNativeApp() && !isNativeDriverApp();

  useEffect(() => {
    if (!native) return;
    document.documentElement.dataset.poreiagoApp = 'wallet';
    return () => {
      delete document.documentElement.dataset.poreiagoApp;
    };
  }, [native]);

  useEffect(() => {
    if (!native) return;
    const path = location.pathname || '/';
    if (isWalletAppPath(path)) return;
    navigate('/wallet', { replace: true });
  }, [native, location.pathname, navigate]);

  if (native && !isWalletAppPath(location.pathname)) {
    return <Navigate to="/wallet" replace />;
  }

  return null;
}
