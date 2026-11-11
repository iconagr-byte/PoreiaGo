/**
 * Native Capacitor: open My Wallet → Ενοικιάσεις sealed to IconaRent (iconarent)
 * so catalog/bookings hit a real rent office — not Achillio / PoreiaGo platform.
 */

import { loginAsCustomer } from '../auth.js';
import { setWalletTenantId, clearWalletTenantId } from '../wallet/walletTenantSeal.js';
import { markPreferRentLookup } from './preferRentLookup.js';

export const NATIVE_RENT_DEMO_KEY = 'poreiago_native_rent_demo_v1';
export const NATIVE_RENT_DEMO_EMAIL = 'demo-rent@poreiago.local';
export const NATIVE_RENT_DEMO_TOKEN = 'native-rent-demo';

/** IconaRent office — Ιψονα ρεντ / iconarent.poreiago.com */
export const NATIVE_RENT_DEMO_OFFICE_SLUG = 'iconarent';
export const NATIVE_RENT_DEMO_OFFICE_HOST = 'iconarent.poreiago.com';
/** Production tenant id fallback when appearance resolve fails. */
export const NATIVE_RENT_DEMO_TENANT_FALLBACK = '0b0f6982-caa6-4efb-8e4e-7ea5a231f1cd';

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

/**
 * Resolve IconaRent tenant_id from office appearance asset URL, else fallback.
 * @returns {Promise<string>}
 */
export async function resolveNativeRentDemoTenantId() {
  const fallback = NATIVE_RENT_DEMO_TENANT_FALLBACK;
  try {
    const url = `https://${NATIVE_RENT_DEMO_OFFICE_HOST}/api/site/appearance`;
    const res = await fetch(url, {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const logo = String(data?.logo_url || data?.rent_logo_url || '');
    const hit = logo.match(/office-assets\/([0-9a-f-]{36})\//i);
    if (hit?.[1]) return hit[1];
  } catch {
    /* offline / CORS — use known IconaRent id */
  }
  return fallback;
}

/** Enter My Wallet rentals tab sealed to IconaRent. */
export async function enterNativeRentDemoWallet() {
  enableNativeRentDemo();
  try {
    const tid = await resolveNativeRentDemoTenantId();
    if (tid) setWalletTenantId(tid);
    else clearWalletTenantId();
  } catch {
    try {
      setWalletTenantId(NATIVE_RENT_DEMO_TENANT_FALLBACK);
    } catch {
      clearWalletTenantId();
    }
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
