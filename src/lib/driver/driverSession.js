/**
 * Driver Command Center session — bound to trip/day via password / Master QR.
 *
 * Auth is intentionally NOT sticky across app launches: localStorage leftovers
 * are ignored/cleared so reopening /driver always shows the login gate unless
 * this visit just authenticated (sessionStorage fresh marker).
 */

const STORAGE_KEY = 'driver_command_session';
const FRESH_AUTH_KEY = 'driver_auth_fresh';

function readSessionRaw() {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeSessionRaw(value) {
  try {
    sessionStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* private mode / quota */
  }
}

function removeSessionRaw() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Drop forever-sticky auth from older builds (localStorage). */
export function purgeStickyDriverSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('driverActiveTripId');
  } catch {
    /* ignore */
  }
}

export function markDriverAuthFresh() {
  try {
    sessionStorage.setItem(FRESH_AUTH_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** True once after a successful login in this browser tab/visit. */
export function consumeDriverAuthFresh() {
  try {
    if (sessionStorage.getItem(FRESH_AUTH_KEY) === '1') {
      sessionStorage.removeItem(FRESH_AUTH_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function getDriverSession() {
  try {
    const raw = readSessionRaw();
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
  writeSessionRaw(JSON.stringify(session));
  // Never keep a sticky copy — reopen must ask for credentials again.
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem('userRole', 'driver');
    localStorage.setItem('driverApiKey', 'dev-driver-key');
    if (session.tripId != null) {
      sessionStorage.setItem('driverActiveTripId', String(session.tripId));
      localStorage.removeItem('driverActiveTripId');
    }
  } catch {
    /* ignore */
  }
  markDriverAuthFresh();
}

export function clearDriverSession() {
  removeSessionRaw();
  try {
    sessionStorage.removeItem('driverActiveTripId');
    sessionStorage.removeItem(FRESH_AUTH_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem('driverActiveTripId');
  } catch {
    /* ignore */
  }
}

export function isSessionValid() {
  return getDriverSession() != null;
}

/**
 * Cold-open gate: allow through only right after login/QR in this visit.
 * Otherwise wipe any residual session and force the login screen.
 */
export function resolveDriverAuthOnLaunch() {
  purgeStickyDriverSession();
  if (consumeDriverAuthFresh() && isSessionValid()) {
    return true;
  }
  clearDriverSession();
  return false;
}

/** Authorization for /api/driver/* (session JWT). */
export function driverSessionHeaders() {
  const s = getDriverSession();
  if (!s?.accessToken) return {};
  return { Authorization: `Bearer ${s.accessToken}` };
}

export function getActiveTripId() {
  const s = getDriverSession();
  if (s?.tripId != null) return s.tripId;
  try {
    const fromSession = Number(sessionStorage.getItem('driverActiveTripId'));
    if (fromSession) return fromSession;
  } catch {
    /* ignore */
  }
  return 1;
}
