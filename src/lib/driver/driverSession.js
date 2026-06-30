/**
 * Driver Command Center session — bound to trip/day via Master QR.
 */

const STORAGE_KEY = 'driver_command_session';

export function getDriverSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session.expiresAt && Date.now() > session.expiresAt * 1000) {
      clearDriverSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveDriverSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  localStorage.setItem('userRole', 'driver');
  localStorage.setItem('driverApiKey', 'dev-driver-key');
  if (session.tripId != null) {
    localStorage.setItem('driverActiveTripId', String(session.tripId));
  }
}

export function clearDriverSession() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('driverActiveTripId');
}

export function isSessionValid() {
  return getDriverSession() != null;
}

/** Authorization for /api/driver/* (Master QR session JWT). */
export function driverSessionHeaders() {
  const s = getDriverSession();
  if (!s?.accessToken) return {};
  return { Authorization: `Bearer ${s.accessToken}` };
}

export function getActiveTripId() {
  const s = getDriverSession();
  return s?.tripId ?? (Number(localStorage.getItem('driverActiveTripId')) || 1);
}
