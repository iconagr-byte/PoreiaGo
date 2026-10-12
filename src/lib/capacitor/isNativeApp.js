/** True when running inside Capacitor (Android / iOS shell). */
export function isNativeApp() {
  if (typeof window === 'undefined') return false;
  const cap = window.Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function') {
    return Boolean(cap.isNativePlatform());
  }
  return Boolean(cap?.getPlatform && cap.getPlatform() !== 'web');
}

export function isWalletAndroidApp() {
  return isNativeApp();
}
