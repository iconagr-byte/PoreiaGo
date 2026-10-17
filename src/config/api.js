/**
 * API origin for fetch calls.
 *
 * Capacitor packaged Wallet serves from https://localhost — relative `/api`
 * would hit the WebView, not the VPS. Point native shells at the office host
 * so Google/email login and wallet APIs reach production.
 */
function resolveApiBase() {
  const fromEnv = String(import.meta.env.VITE_API_BASE || '')
    .trim()
    .replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  if (typeof window === 'undefined') return '';

  try {
    const host = String(window.location?.hostname || '').toLowerCase();
    const port = String(window.location?.port || '');
    const cap = window.Capacitor;
    const nativePlatform =
      (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) ||
      (cap &&
        typeof cap.getPlatform === 'function' &&
        /^(android|ios)$/i.test(String(cap.getPlatform() || ''))) ||
      /Capacitor/i.test(String(navigator.userAgent || '')) ||
      (host === 'localhost' && (!port || port === '80' || port === '443'));

    const markedWallet =
      typeof document !== 'undefined' &&
      document.documentElement?.getAttribute('data-poreiago-app') === 'wallet';

    if (nativePlatform || markedWallet) {
      const native =
        String(import.meta.env.VITE_NATIVE_API_BASE || '')
          .trim()
          .replace(/\/$/, '') || 'https://www.achilliotravel.com';
      return native;
    }
  } catch {
    /* ignore */
  }

  return '';
}

/** Prefer this — re-resolves after Capacitor / data-poreiago-app boot. */
export function getApiBase() {
  return resolveApiBase();
}

/** Snapshot at first import; native code should prefer getApiBase(). */
export const API_BASE = resolveApiBase();

export const DRIVER_API_KEY =
  import.meta.env.VITE_DRIVER_API_KEY || 'dev-driver-key';

export function driverAuthHeaders() {
  const key = localStorage.getItem('driverApiKey') || DRIVER_API_KEY;
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}
