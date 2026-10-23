/**
 * Driver Command Center session — bound to trip/day via password / Master QR.
 *
 * Web / PWA: auth is NOT sticky across launches (sessionStorage + fresh marker).
 * Native Capacitor (unified PoreiaGo app + legacy driver package): JWT persists
 * in localStorage so a valid session opens the command center on cold start.
 */

import { shouldPersistNativeDriverSession } from '../capacitor/isNativeApp.js';
import { rememberNativeRoleHome, NATIVE_ROLE_DRIVER } from '../capacitor/nativeRoleHome.js';

const STORAGE_KEY = 'driver_command_session';
const FRESH_AUTH_KEY = 'driver_auth_fresh';
const OFFICE_SEAL_KEY = 'driver_native_office_seal';

function persistNativeDriver() {
  return shouldPersistNativeDriverSession();
}

function readSessionRaw() {
  try {
    const fromSession = sessionStorage.getItem(STORAGE_KEY);
    if (fromSession) return fromSession;
  } catch {
    /* ignore */
  }
  // Native: restore sealed JWT across process death.
  if (persistNativeDriver()) {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  return null;
}

function writeSessionRaw(value) {
  try {
    sessionStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* private mode / quota */
  }
  if (persistNativeDriver()) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
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

/** Persist office host + tenant so Achillio drivers stay on Achillio APIs. */
export function sealDriverOffice({ tenantId, apiHost } = {}) {
  if (!persistNativeDriver()) return;
  try {
    const host =
      String(apiHost || '').trim().replace(/\/$/, '') ||
      String(import.meta.env.VITE_NATIVE_API_BASE || '').trim().replace(/\/$/, '') ||
      'https://www.achilliotravel.com';
    const seal = {
      tenantId: tenantId || null,
      apiHost: host,
      sealedAt: Date.now(),
    };
    localStorage.setItem(OFFICE_SEAL_KEY, JSON.stringify(seal));
  } catch {
    /* ignore */
  }
}

export function getDriverOfficeSeal() {
  try {
    const raw = localStorage.getItem(OFFICE_SEAL_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearDriverOfficeSeal() {
  try {
    localStorage.removeItem(OFFICE_SEAL_KEY);
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
  if (!persistNativeDriver()) {
    // Web: never keep a sticky copy — reopen must ask for credentials again.
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  } else {
    if (session?.tenantId) {
      sealDriverOffice({ tenantId: session.tenantId });
    }
    rememberNativeRoleHome(NATIVE_ROLE_DRIVER);
  }
  try {
    localStorage.setItem('userRole', 'driver');
    localStorage.setItem('driverApiKey', 'dev-driver-key');
    if (session.tripId != null && Number(session.tripId) > 0) {
      sessionStorage.setItem('driverActiveTripId', String(session.tripId));
      localStorage.removeItem('driverActiveTripId');
    } else {
      sessionStorage.removeItem('driverActiveTripId');
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
  // Keep office seal on logout so the next login still hits the same office host.
}

export function isSessionValid() {
  return getDriverSession() != null;
}

/**
 * Cold-open gate.
 * - Native (unified or legacy driver package): valid persisted JWT → command center.
 * - Web/PWA: only right after login/QR in this visit (fresh marker).
 */
export function resolveDriverAuthOnLaunch() {
  if (persistNativeDriver()) {
    // Drop legacy web sticky leftovers that are not our sealed JWT shape.
    try {
      localStorage.removeItem('driverActiveTripId');
    } catch {
      /* ignore */
    }
    if (isSessionValid()) {
      markDriverAuthFresh();
      rememberNativeRoleHome(NATIVE_ROLE_DRIVER);
      return true;
    }
    clearDriverSession();
    return false;
  }
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
  if (s?.tripId != null && Number(s.tripId) > 0) return Number(s.tripId);
  try {
    const fromSession = Number(sessionStorage.getItem('driverActiveTripId'));
    if (fromSession > 0) return fromSession;
  } catch {
    /* ignore */
  }
  // Never invent demo trip #1 — office must assign / open an excursion.
  return null;
}

/** Drop trip binding (keep auth) when office has not opened an excursion. */
export function clearDriverTripBinding() {
  const s = getDriverSession();
  if (!s) return null;
  const next = {
    ...s,
    tripId: null,
    tripTitle: null,
    destination: null,
    meetingPoint: null,
    schedule: [],
  };
  try {
    writeSessionRaw(JSON.stringify(next));
    sessionStorage.removeItem('driverActiveTripId');
    localStorage.removeItem('driverActiveTripId');
    // Drop offline demo manifests that painted Εκδρομή #1 + κάτοψη.
    Object.keys(localStorage)
      .filter((k) => k.startsWith('driver_manifest_'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('driver-trip-cleared'));
  return next;
}

export function hasOpenDriverTrip(session = getDriverSession()) {
  return Boolean(session?.tripId != null && Number(session.tripId) > 0);
}
