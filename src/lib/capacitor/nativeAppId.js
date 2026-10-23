/**
 * Which Capacitor product shell is running.
 * - wallet → My Wallet (com.poreiago.wallet)
 * - driver → Driver command center (com.poreiago.driver)
 * - null → web / unknown
 */

export const NATIVE_APP_WALLET = 'wallet';
export const NATIVE_APP_DRIVER = 'driver';

function readDatasetApp() {
  try {
    const v = document?.documentElement?.dataset?.poreiagoApp;
    if (v === NATIVE_APP_WALLET || v === NATIVE_APP_DRIVER) return v;
  } catch {
    /* ignore */
  }
  return null;
}

function readBuildFlavor() {
  try {
    const v = String(import.meta.env.VITE_NATIVE_APP || '')
      .trim()
      .toLowerCase();
    if (v === NATIVE_APP_WALLET || v === NATIVE_APP_DRIVER) return v;
  } catch {
    /* ignore */
  }
  return null;
}

function readWindowMarker() {
  try {
    const v = String(window.__POREIAGO_NATIVE_APP__ || '')
      .trim()
      .toLowerCase();
    if (v === NATIVE_APP_WALLET || v === NATIVE_APP_DRIVER) return v;
  } catch {
    /* ignore */
  }
  return null;
}

/** Resolve product flavor (build marker → dataset → window). */
export function getNativeAppId() {
  return readBuildFlavor() || readDatasetApp() || readWindowMarker() || null;
}

export function isNativeDriverApp() {
  return getNativeAppId() === NATIVE_APP_DRIVER;
}

export function isNativeWalletApp() {
  return getNativeAppId() === NATIVE_APP_WALLET;
}

/** Apply data-poreiago-app for CSS / early boot parity. */
export function markNativeAppShell(appId) {
  if (typeof document === 'undefined') return;
  if (appId !== NATIVE_APP_WALLET && appId !== NATIVE_APP_DRIVER) return;
  try {
    document.documentElement.dataset.poreiagoApp = appId;
    document.documentElement.setAttribute('data-poreiago-app', appId);
  } catch {
    /* ignore */
  }
}
