import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { isNativeApp, isNativeDriverApp } from '../../lib/capacitor/isNativeApp.js';
import { isNativeUnifiedApp } from '../../lib/capacitor/nativeAppId.js';

/**
 * Legacy wallet-only path seal.
 * Unified Capacitor app (com.poreiago.wallet with role router) uses NativeUnifiedBoot —
 * this component no-ops there so /driver and /rent stay reachable.
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
 * Capacitor Wallet app (legacy flavor only): traveler My Wallet.
 * Skipped for unified role app and for Driver native shell.
 */
export default function WalletNativeBoot() {
  const location = useLocation();
  const navigate = useNavigate();
  // Unified shell owns path seals; legacy driver package also skips.
  const native = isNativeApp() && !isNativeDriverApp() && !isNativeUnifiedApp();

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
