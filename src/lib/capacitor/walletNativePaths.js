/**
 * Legacy wallet-only Capacitor path seal (WalletNativeBoot).
 * Keep in sync with index.html pathAllowed + isUnifiedNativeAppPath booking routes.
 */

export const WALLET_APP_PREFIXES = [
  '/wallet',
  '/my-booking',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/ticket/',
  '/passenger-checkin',
  '/wallet/native-google',
  // Booking flow from Wallet Κράτηση — must not bounce to /wallet mid-load.
  '/select-seat',
  '/book/',
  '/checkout',
  '/trip/',
  '/track/',
];

export function isWalletAppPath(pathname) {
  const p = pathname || '/';
  return WALLET_APP_PREFIXES.some((prefix) => {
    if (prefix.endsWith('/')) return p === prefix.slice(0, -1) || p.startsWith(prefix);
    return p === prefix || p.startsWith(`${prefix}/`);
  });
}
