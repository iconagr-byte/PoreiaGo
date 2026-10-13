/** True when running inside Capacitor (Android / iOS shell). */
export function isNativeApp() {
  if (typeof window === 'undefined') return false;
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
  // Capacitor WebView user-agent fallback
  const ua = String(navigator.userAgent || '');
  if (/Capacitor/i.test(ua)) return true;
  return false;
}

export function isWalletAndroidApp() {
  return isNativeApp();
}
