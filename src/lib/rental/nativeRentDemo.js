/**
 * Native Capacitor: open My Wallet → Ενοικιάσεις without creating an office.
 * Soft local customer session so the wallet shell mounts (not /rent guest page).
 */

import { loginAsCustomer } from '../auth.js';
import { clearWalletTenantId } from '../wallet/walletTenantSeal.js';
import { markPreferRentLookup } from './preferRentLookup.js';

export const NATIVE_RENT_DEMO_KEY = 'poreiago_native_rent_demo_v1';
export const NATIVE_RENT_DEMO_EMAIL = 'demo-rent@poreiago.local';
export const NATIVE_RENT_DEMO_TOKEN = 'native-rent-demo';

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

/** Enter My Wallet rentals tab chrome without a real office JWT. */
export function enterNativeRentDemoWallet() {
  enableNativeRentDemo();
  // Drop Achillio (or any) seal so modules/catalog stay demo-friendly.
  try {
    clearWalletTenantId();
  } catch {
    /* ignore */
  }
  loginAsCustomer(
    NATIVE_RENT_DEMO_EMAIL,
    {
      name: 'Demo Rent',
      provider: 'demo',
    },
    NATIVE_RENT_DEMO_TOKEN,
  );
}

export function clearNativeRentDemo() {
  try {
    sessionStorage.removeItem(NATIVE_RENT_DEMO_KEY);
  } catch {
    /* ignore */
  }
}
