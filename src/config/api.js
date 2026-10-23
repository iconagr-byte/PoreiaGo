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

    const markedApp =
      typeof document !== 'undefined' &&
      ['wallet', 'driver'].includes(
        String(document.documentElement?.getAttribute('data-poreiago-app') || ''),
      );

    const buildFlavor = String(import.meta.env.VITE_NATIVE_APP || '')
      .trim()
      .toLowerCase();

    if (nativePlatform || markedApp || buildFlavor === 'wallet' || buildFlavor === 'driver') {
      // Native Driver may seal a specific office host after first login.
      try {
        if (buildFlavor === 'driver' || document.documentElement?.dataset?.poreiagoApp === 'driver') {
          const raw = localStorage.getItem('driver_native_office_seal');
          if (raw) {
            const seal = JSON.parse(raw);
            const sealedHost = String(seal?.apiHost || '')
              .trim()
              .replace(/\/$/, '');
            if (sealedHost) return sealedHost;
          }
        }
      } catch {
        /* ignore */
      }
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
