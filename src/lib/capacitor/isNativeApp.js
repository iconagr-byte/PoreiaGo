/** True when running inside Capacitor (Android / iOS shell). */
export function isNativeApp() {
  if (typeof window === 'undefined') return false;
  try {
    if (document?.documentElement?.dataset?.poreiagoApp === 'wallet') {
      return true;
    }
  } catch {
    /* ignore */
  }
  try {
    const cap = window.Capacitor;
    if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
      return true;
    }
    if (cap && typeof cap.getPlatform === 'function') {
      const p = String(cap.getPlatform() || '').toLowerCase();
      if (p === 'android' || p === 'ios') return true;
    }
  } catch {
    /* ignore */
  }
  // Capacitor WebView user-agent / origin fallbacks
  const ua = String(navigator.userAgent || '');
  if (/Capacitor/i.test(ua)) return true;
  try {
    const host = String(window.location?.hostname || '').toLowerCase();
    if (host === 'localhost' && /^https?:$/.test(window.location?.protocol || '')) {
      // Packaged Capacitor serves from https://localhost — not Vite (5173).
      const port = String(window.location?.port || '');
      if (!port || port === '443' || port === '80') return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function isWalletAndroidApp() {
  return isNativeApp();
}
