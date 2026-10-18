/** Native Wallet brand splash — once per app session before login fields. */

export const WALLET_BRAND_SPLASH_KEY = 'pg_wallet_splash_v1';

export const WALLET_SPLASH_BRAND = 'PoreiaGo';

/** Quality-first hook under the wordmark (Qatar-style secondary line). */
export const WALLET_SPLASH_HOOK = 'Αξιοπιστία σε κάθε διαδρομή';

export const WALLET_SPLASH_SUPPORT =
  'Ασφάλεια · άνεση · εμπιστοσύνη — η εμπειρία που αξίζει κάθε ταξιδιώτης.';

export function hasSeenWalletBrandSplash() {
  if (typeof window === 'undefined') return true;
  try {
    return sessionStorage.getItem(WALLET_BRAND_SPLASH_KEY) === '1';
  } catch {
    return false;
  }
}

export function markWalletBrandSplashSeen() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(WALLET_BRAND_SPLASH_KEY, '1');
  } catch {
    /* private mode */
  }
}

/** Auto-advance delay (ms) — enough to read the brand, then login. */
export const WALLET_SPLASH_DURATION_MS = 2600;
