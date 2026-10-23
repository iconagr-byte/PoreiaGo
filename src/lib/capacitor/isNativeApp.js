import {
  getNativeAppId,
  isNativeDriverApp,
  isNativeUnifiedApp,
  isNativeWalletApp,
} from './nativeAppId.js';

/**
 * True when running inside Capacitor (Android / iOS shell).
 * Do not trust VITE_NATIVE_APP / window flavor alone — web production builds
 * also inject a marker into index.html for Capacitor sync.
 */
export function isNativeApp() {
  if (typeof window === 'undefined') return false;

  // Early index.html boot sets data-poreiago-app only after Capacitor/localhost detection.
  try {
    const ds = String(document.documentElement?.dataset?.poreiagoApp || '')
      .trim()
      .toLowerCase();
    if (ds === 'wallet' || ds === 'driver' || ds === 'app') return true;
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

/** Packaged My Wallet / unified PoreiaGo app (not legacy driver-only APK). */
export function isWalletAndroidApp() {
  return isNativeApp() && !isNativeDriverApp();
}

/**
 * Persist driver JWT across process death in any Capacitor shell
 * (unified app + legacy driver package). Web/PWA stays session-only.
 */
export function shouldPersistNativeDriverSession() {
  return isNativeApp();
}

export {
  isNativeDriverApp,
  isNativeWalletApp,
  isNativeUnifiedApp,
  getNativeAppId,
};
