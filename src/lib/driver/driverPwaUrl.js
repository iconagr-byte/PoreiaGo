/** Public URL for Driver PWA (bus phone) — not BackOffice /admin. */

export function getDriverAppOrigin() {
  const fromEnv = import.meta.env.VITE_DRIVER_APP_URL || import.meta.env.VITE_APP_ORIGIN;
  if (fromEnv) return String(fromEnv).replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost:5173';
}

/** Share / install QR — always the driver login entrance. */
export function getDriverPwaLoginUrl() {
  return `${getDriverAppOrigin()}/driver/login`;
}

export function getDriverPwaStartUrl(_tab = 'gps') {
  return getDriverPwaLoginUrl();
}
