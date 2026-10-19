/**
 * Native Wallet brand splash — once per WebView cold start (in-memory),
 * and again after logout so login always shows the PoreiaGo mark.
 */

export const WALLET_BRAND_SPLASH_KEY = 'pg_wallet_splash_v1';
export const WALLET_BOOT_SPLASH_ID = 'pg-wallet-boot-splash';

export const WALLET_SPLASH_BRAND = 'PoreiaGo';

/** Quality-first hook under the wordmark (Apple-style secondary line). */
export const WALLET_SPLASH_HOOK = 'Αξιοπιστία σε κάθε διαδρομή';

export const WALLET_SPLASH_SUPPORT =
  'Ασφάλεια · άνεση · εμπιστοσύνη';

/** Resets every time the Capacitor WebView loads the JS bundle. */
let seenThisRuntime = false;

export function hasSeenWalletBrandSplash() {
  return seenThisRuntime;
}

export function markWalletBrandSplashSeen() {
  seenThisRuntime = true;
  dismissWalletBootSplash();
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(WALLET_BRAND_SPLASH_KEY);
    } catch {
      /* ignore */
    }
  }
}

/** Call on logout so the next login shows the brand splash again. */
export function resetWalletBrandSplash() {
  seenThisRuntime = false;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(WALLET_BRAND_SPLASH_KEY);
    } catch {
      /* ignore */
    }
  }
}

/** Remove the HTML boot splash painted before React mounts. */
export function dismissWalletBootSplash() {
  if (typeof document === 'undefined') return;
  try {
    const el = document.getElementById(WALLET_BOOT_SPLASH_ID);
    if (!el) return;
    el.classList.add('pg-wallet-boot-splash--out');
    window.setTimeout(() => {
      try {
        el.remove();
      } catch {
        /* ignore */
      }
    }, 380);
  } catch {
    /* ignore */
  }
}

/** Auto-advance delay (ms) — enough to feel the brand, then continue. */
export const WALLET_SPLASH_DURATION_MS = 3400;
