/**
 * Native Wallet brand splash — once per WebView cold start (in-memory).
 * sessionStorage was wrong: rebuild scripts / soft reloads could skip it,
 * and wallet-run used to reset to a branch without the splash UI.
 */

export const WALLET_BRAND_SPLASH_KEY = 'pg_wallet_splash_v1';

export const WALLET_SPLASH_BRAND = 'PoreiaGo';

/** Short Apple-style hook under the wordmark — personal, calm, scannable. */
export const WALLET_SPLASH_HOOK = 'Τα εισιτήριά σας. Πάντα έτοιμα.';

export const WALLET_SPLASH_SUPPORT =
  'Επιβίβαση με ένα άγγιγμα — απλά, ασφαλώς, δίπλα σας σε κάθε διαδρομή.';

/** Resets every time the Capacitor WebView loads the JS bundle. */
let seenThisRuntime = false;

export function hasSeenWalletBrandSplash() {
  return seenThisRuntime;
}

export function markWalletBrandSplashSeen() {
  seenThisRuntime = true;
  // Legacy cleanup from older builds that used sessionStorage.
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(WALLET_BRAND_SPLASH_KEY);
    } catch {
      /* ignore */
    }
  }
}

/** Auto-advance delay (ms) — enough to read the brand, then continue. */
export const WALLET_SPLASH_DURATION_MS = 3000;
