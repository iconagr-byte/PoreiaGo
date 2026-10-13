import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isNativeApp } from '../../lib/capacitor/isNativeApp.js';

/** My Wallet only — no storefront, admin, driver, or rent. */
const WALLET_APP_PREFIXES = [
  '/wallet',
  '/my-booking',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/ticket/',
  '/passenger-checkin',
];

function isWalletAppPath(pathname) {
  const p = pathname || '/';
  return WALLET_APP_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix));
}

/**
 * Capacitor Wallet app: traveler My Wallet only.
 * Blocks marketing home, trip browse, admin, driver, rent.
 */
export default function WalletNativeBoot() {
  const location = useLocation();
  const navigate = useNavigate();
  const native = isNativeApp();

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

  return null;
}
