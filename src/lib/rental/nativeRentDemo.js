/**
 * Native Capacitor: browse Rent showcase without creating an office.
 * Guest /rent + Wallet «Ενοικιάσεις» tab when the flag is on.
 */

import { markPreferRentLookup } from './preferRentLookup.js';

export const NATIVE_RENT_DEMO_KEY = 'poreiago_native_rent_demo_v1';

export function isNativeRentDemo() {
  try {
    if (typeof sessionStorage === 'undefined') return false;
    return sessionStorage.getItem(NATIVE_RENT_DEMO_KEY) === '1';
  } catch {
    return false;
  }
}

export function enableNativeRentDemo() {
  try {
    sessionStorage.setItem(NATIVE_RENT_DEMO_KEY, '1');
  } catch {
    /* ignore */
  }
  markPreferRentLookup();
}

export function clearNativeRentDemo() {
  try {
    sessionStorage.removeItem(NATIVE_RENT_DEMO_KEY);
  } catch {
    /* ignore */
  }
}
