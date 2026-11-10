import { getApiBase } from '../../config/api.js';
import { isNativeApp } from './isNativeApp.js';

const CRED_QUERY = 'google_credential';
const CRED_HASH = 'google_credential';

/** Host where Google GIS is allowlisted (storefront), not Capacitor https://localhost. */
export function nativeGoogleBridgeHost() {
  return (
    String(getApiBase() || '')
      .trim()
      .replace(/\/$/, '') || 'https://www.achilliotravel.com'
  );
}

/**
 * Capacitor WebView origin is https://localhost — Google rejects GIS with origin_mismatch
 * unless that origin is in Cloud Console. Bridge runs GIS on the office host instead.
 */
export function buildNativeGoogleBridgeUrl({ mode = 'signin', returnPath = '/login' } = {}) {
  const host = nativeGoogleBridgeHost();
  const q = new URLSearchParams({
    mode: mode === 'signup' ? 'signup' : 'signin',
    return: returnPath.startsWith('/') ? returnPath : `/${returnPath}`,
  });
  return `${host}/wallet/native-google?${q.toString()}`;
}

export function startNativeGoogleBridge({ mode = 'signin', returnPath = '/login' } = {}) {
  if (typeof window === 'undefined') return false;
  if (!isNativeApp()) return false;
  const url = buildNativeGoogleBridgeUrl({ mode, returnPath });
  window.location.assign(url);
  return true;
}

/** Packaged WebView return target after GIS on the office host. */
export function nativeGoogleReturnUrl(returnPath, credential) {
  const path = returnPath.startsWith('/') ? returnPath : `/${returnPath}`;
  const hash = `${CRED_HASH}=${encodeURIComponent(credential)}`;
  return `https://localhost${path}#${hash}`;
}

/**
 * Read + clear a Google ID token handed back from the native bridge.
 * Supports hash (preferred) and query string.
 */
export function takeGoogleCredentialFromLocation(locationLike = window.location) {
  if (typeof window === 'undefined' && !locationLike) return null;
  const loc = locationLike || window.location;
  let credential = '';

  const hash = String(loc.hash || '').replace(/^#/, '');
  if (hash) {
    const hp = new URLSearchParams(hash);
    credential = String(hp.get(CRED_HASH) || '').trim();
    if (credential && typeof window !== 'undefined') {
      const next = new URLSearchParams(hash);
      next.delete(CRED_HASH);
      const rest = next.toString();
      window.history.replaceState(
        null,
        '',
        `${loc.pathname}${loc.search}${rest ? `#${rest}` : ''}`,
      );
    }
  }

  if (!credential) {
    const sp = new URLSearchParams(String(loc.search || '').replace(/^\?/, ''));
    credential = String(sp.get(CRED_QUERY) || '').trim();
    if (credential && typeof window !== 'undefined') {
      sp.delete(CRED_QUERY);
      const q = sp.toString();
      window.history.replaceState(
        null,
        '',
        `${loc.pathname}${q ? `?${q}` : ''}${loc.hash || ''}`,
      );
    }
  }

  return credential || null;
}
