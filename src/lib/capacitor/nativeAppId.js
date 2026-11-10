/**
 * Which Capacitor product shell is running.
 *
 * Canonical install (one app):
 *   app | wallet → com.poreiago.wallet (unified role router)
 *
 * Legacy (deprecated — do not ship new installs):
 *   driver → com.poreiago.driver (android-driver/)
 *
 * null → web / unknown
 */

export const NATIVE_APP_WALLET = 'wallet';
export const NATIVE_APP_DRIVER = 'driver';
/** Unified PoreiaGo native shell (same Android package as wallet). */
export const NATIVE_APP_UNIFIED = 'app';

function normalizeFlavor(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (v === NATIVE_APP_DRIVER) return NATIVE_APP_DRIVER;
  if (v === NATIVE_APP_UNIFIED || v === NATIVE_APP_WALLET) return v;
  return null;
}

function readDatasetApp() {
  try {
    return normalizeFlavor(document?.documentElement?.dataset?.poreiagoApp);
  } catch {
    /* ignore */
  }
  return null;
}

function readBuildFlavor() {
  try {
    return normalizeFlavor(import.meta.env.VITE_NATIVE_APP);
  } catch {
    /* ignore */
  }
  return null;
}

function readWindowMarker() {
  try {
    return normalizeFlavor(window.__POREIAGO_NATIVE_APP__);
  } catch {
    /* ignore */
  }
  return null;
}

/** Resolve product flavor (build marker → dataset → window). */
export function getNativeAppId() {
  return readBuildFlavor() || readDatasetApp() || readWindowMarker() || null;
}

/**
 * True when this install is the single PoreiaGo app (role-routed).
 * Legacy driver-only APK is NOT unified.
 */
export function isNativeUnifiedApp() {
  const id = getNativeAppId();
  return id === NATIVE_APP_UNIFIED || id === NATIVE_APP_WALLET;
}

/**
 * Legacy driver-only Capacitor package (com.poreiago.driver).
 * Prefer isNativeUnifiedApp() + role home for new work.
 */
export function isNativeDriverApp() {
  return getNativeAppId() === NATIVE_APP_DRIVER;
}

export function isNativeWalletApp() {
  const id = getNativeAppId();
  return id === NATIVE_APP_WALLET || id === NATIVE_APP_UNIFIED;
}

/** Apply data-poreiago-app for CSS / early boot parity. */
export function markNativeAppShell(appId) {
  if (typeof document === 'undefined') return;
  const id = normalizeFlavor(appId);
  if (!id) return;
  try {
    document.documentElement.dataset.poreiagoApp = id;
    document.documentElement.setAttribute('data-poreiago-app', id);
  } catch {
    /* ignore */
  }
}

/**
 * Mark the active role surface inside the unified shell
 * (wallet | driver | rent) without changing the package flavor.
 */
export function markNativeRoleSurface(role) {
  if (typeof document === 'undefined') return;
  const r = String(role || '')
    .trim()
    .toLowerCase();
  if (r !== 'driver' && r !== 'wallet' && r !== 'rent') return;
  try {
    document.documentElement.dataset.poreiagoRole = r;
    document.documentElement.setAttribute('data-poreiago-role', r);
  } catch {
    /* ignore */
  }
}
