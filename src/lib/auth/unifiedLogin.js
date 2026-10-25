/**
 * Single login form → detect account role and home path.
 *
 * Order: customer auth → (on credential failure) driver portal.
 * Customer surface: explicit hint → remembered role → rent preference →
 * booking probe (rent-only → Rent Wallet, else My Wallet).
 */

import { loginCustomer } from '../../services/customerAuthApi.js';
import { loginDriver } from '../../services/driverPortalApi.js';
import { fetchMyBookingsFromServer } from '../../services/customerBookingsApi.js';
import { fetchMyRentalBookings } from '../../services/customerRentalApi.js';
import { hasPreferRentLookup } from '../rental/preferRentLookup.js';
import {
  getRememberedNativeRoleHome,
  NATIVE_ROLE_DRIVER,
  NATIVE_ROLE_RENT,
  NATIVE_ROLE_WALLET,
  pathForNativeRole,
} from '../capacitor/nativeRoleHome.js';

export function isNetworkAuthError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return /fetch|network|σύνδεση με τον server|δεν υπάρχει σύνδεση|διαθέσιμος|502|504|timeout/.test(
    msg,
  );
}

/**
 * Pick My Wallet vs Rent Wallet for a customer who just authenticated.
 * @param {{ preferRent?: boolean, preferWallet?: boolean }} hints
 */
export async function resolveCustomerSurface(hints = {}) {
  const preferRent = Boolean(hints.preferRent);
  const preferWallet = Boolean(hints.preferWallet);

  if (preferRent && !preferWallet) {
    return { role: NATIVE_ROLE_RENT, path: pathForNativeRole(NATIVE_ROLE_RENT) };
  }
  if (preferWallet) {
    return { role: NATIVE_ROLE_WALLET, path: pathForNativeRole(NATIVE_ROLE_WALLET) };
  }

  const remembered = getRememberedNativeRoleHome();
  if (remembered === NATIVE_ROLE_RENT || remembered === NATIVE_ROLE_WALLET) {
    return { role: remembered, path: pathForNativeRole(remembered) };
  }

  try {
    if (hasPreferRentLookup()) {
      return { role: NATIVE_ROLE_RENT, path: pathForNativeRole(NATIVE_ROLE_RENT) };
    }
  } catch {
    /* ignore */
  }

  let busCount = 0;
  let rentCount = 0;
  try {
    const [bus, rent] = await Promise.all([
      fetchMyBookingsFromServer()
        .then((items) => (Array.isArray(items) ? items.length : 0))
        .catch(() => 0),
      fetchMyRentalBookings()
        .then((items) => (Array.isArray(items) ? items.length : 0))
        .catch(() => 0),
    ]);
    busCount = bus;
    rentCount = rent;
  } catch {
    /* default wallet */
  }

  if (rentCount > 0 && busCount === 0) {
    return { role: NATIVE_ROLE_RENT, path: pathForNativeRole(NATIVE_ROLE_RENT) };
  }

  return { role: NATIVE_ROLE_WALLET, path: pathForNativeRole(NATIVE_ROLE_WALLET) };
}

/**
 * @param {string} email
 * @param {string} password
 * @param {{ preferRent?: boolean, preferWallet?: boolean }} [hints]
 * @returns {Promise<
 *   | { kind: 'customer', result: object, role: string, path: string }
 *   | { kind: 'driver', session: object, role: string, path: string }
 * >}
 */
export async function attemptUnifiedLogin(email, password, hints = {}) {
  const emailN = String(email || '').trim().toLowerCase();
  const passwordN = String(password || '');

  let customerErr = null;
  try {
    const result = await loginCustomer({ email: emailN, password: passwordN });
    const surface = await resolveCustomerSurface(hints);
    return {
      kind: 'customer',
      result,
      role: surface.role,
      path: surface.path,
    };
  } catch (err) {
    if (isNetworkAuthError(err)) throw err;
    customerErr = err;
  }

  try {
    const session = await loginDriver(emailN, passwordN);
    return {
      kind: 'driver',
      session,
      role: NATIVE_ROLE_DRIVER,
      path: pathForNativeRole(NATIVE_ROLE_DRIVER),
    };
  } catch (err) {
    if (isNetworkAuthError(err)) throw err;
    throw customerErr || err;
  }
}
