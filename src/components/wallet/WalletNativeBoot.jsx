import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isNativeApp } from '../../lib/capacitor/isNativeApp.js';

/** Paths that belong to the traveler wallet Android app. */
const WALLET_APP_PREFIXES = [
  '/wallet',
  '/my-booking',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/ticket/',
  '/select-seat',
  '/checkout',
  '/trip/',
  '/book/',
  '/passenger-checkin',
  '/track/',
];

function isWalletAppPath(pathname) {
  const p = pathname || '/';
  return WALLET_APP_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix));
}

/**
 * Keep the Capacitor Wallet app inside customer-traveler flows.
 * Blocks marketing home, admin, driver, rent storefront, etc.
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
