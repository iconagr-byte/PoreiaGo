import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { isNativeApp } from '../../lib/capacitor/isNativeApp.js';

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
 */
export default function WalletNativeBoot() {
  const location = useLocation();
  const navigate = useNavigate();
  const native = isNativeApp();

  useEffect(() => {
    if (!native) return;
    // Keep the wallet shell mark for the whole session — do not clear on
    // StrictMode remount or route changes (that used to skip the splash gate).
    document.documentElement.dataset.poreiagoApp = 'wallet';
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
