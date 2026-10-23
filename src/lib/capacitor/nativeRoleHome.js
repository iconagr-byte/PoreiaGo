/**
 * Unified native app — cold-start home by account role.
 *
 * Canonical Android package: com.poreiago.wallet (one install).
 * Role homes:
 *   driver  → /driver          (DriverCommandCenter)
 *   wallet  → /wallet          (SimpleWalletPage / bus My Wallet)
 *   rent    → /rent/wallet     (RentalCustomerApp)
 *   none    → /login           (unified customer login; driver via /driver)
 */

import { getCustomerToken, isCustomer } from '../auth.js';
import { hasPreferRentLookup } from '../rental/preferRentLookup.js';

export const NATIVE_ROLE_DRIVER = 'driver';
export const NATIVE_ROLE_WALLET = 'wallet';
export const NATIVE_ROLE_RENT = 'rent';

export const NATIVE_ROLE_HOME_KEY = 'poreiago_native_role_home_v1';
/** Same key as driverSession — read raw to avoid circular imports. */
const DRIVER_SESSION_KEY = 'driver_command_session';

const ROLE_PATH = {
  [NATIVE_ROLE_DRIVER]: '/driver',
  [NATIVE_ROLE_WALLET]: '/wallet',
  [NATIVE_ROLE_RENT]: '/rent/wallet',
};

function readRememberedRole() {
  try {
    const v = String(localStorage.getItem(NATIVE_ROLE_HOME_KEY) || '')
      .trim()
      .toLowerCase();
    if (v === NATIVE_ROLE_DRIVER || v === NATIVE_ROLE_WALLET || v === NATIVE_ROLE_RENT) {
      return v;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Persist last successful role home (survives Capacitor process death). */
export function rememberNativeRoleHome(role) {
  if (
    role !== NATIVE_ROLE_DRIVER &&
    role !== NATIVE_ROLE_WALLET &&
    role !== NATIVE_ROLE_RENT
  ) {
    return;
  }
  try {
    localStorage.setItem(NATIVE_ROLE_HOME_KEY, role);
  } catch {
    /* ignore */
  }
}

export function clearNativeRoleHome() {
  try {
    localStorage.removeItem(NATIVE_ROLE_HOME_KEY);
  } catch {
    /* ignore */
  }
}

export function getRememberedNativeRoleHome() {
  return readRememberedRole();
}

function readDriverSessionRaw() {
  try {
    const fromSession = sessionStorage.getItem(DRIVER_SESSION_KEY);
    if (fromSession) return fromSession;
  } catch {
    /* ignore */
  }
  try {
    return localStorage.getItem(DRIVER_SESSION_KEY);
  } catch {
    return null;
  }
}

function driverSessionLooksValid() {
  try {
    const raw = readDriverSessionRaw();
    if (!raw) return false;
    const session = JSON.parse(raw);
    if (!session?.accessToken) return false;
    if (session.expiresAt && Date.now() > session.expiresAt * 1000) return false;
    return true;
  } catch {
    return false;
  }
}

function customerSessionLooksValid() {
  try {
    return Boolean(isCustomer() && getCustomerToken());
  } catch {
    return false;
  }
}

/**
 * Resolve role for an authenticated (or remembered) native session.
 * Priority: live driver JWT → customer JWT (+ rent preference) → remembered → none.
 */
export function resolveNativeRole() {
  if (driverSessionLooksValid()) return NATIVE_ROLE_DRIVER;
  if (customerSessionLooksValid()) {
    const remembered = readRememberedRole();
    if (remembered === NATIVE_ROLE_RENT || remembered === NATIVE_ROLE_WALLET) {
      return remembered;
    }
    try {
      if (hasPreferRentLookup()) return NATIVE_ROLE_RENT;
    } catch {
      /* ignore */
    }
    return NATIVE_ROLE_WALLET;
  }
  return null;
}

/** Path to open after Capacitor cold start (or when leaving a blocked URL). */
export function resolveNativeRoleHomePath() {
  const role = resolveNativeRole();
  if (role && ROLE_PATH[role]) return ROLE_PATH[role];
  return '/login';
}

export function pathForNativeRole(role) {
  return ROLE_PATH[role] || '/login';
}

/**
 * Paths allowed inside the unified native shell (no marketing / admin).
 */
export function isUnifiedNativeAppPath(pathname) {
  const p = pathname || '/';
  if (p === '/driver' || p.startsWith('/driver/')) return true;
  if (p === '/wallet' || p.startsWith('/wallet/')) return true;
  if (p === '/rent' || p.startsWith('/rent/')) return true;
  if (p === '/login' || p === '/register') return true;
  if (p.startsWith('/forgot-password') || p.startsWith('/reset-password')) return true;
  if (p === '/my-booking' || p.startsWith('/my-booking/')) return true;
  if (p.startsWith('/ticket/')) return true;
  if (p.startsWith('/passenger-checkin')) return true;
  if (p.startsWith('/sign/')) return true;
  return false;
}
