/**
 * Native Capacitor: open My Wallet → Ενοικιάσεις sealed to IconaRent (iconarent).
 * Prefers a real customer JWT from /api/auth/native-rent-demo; falls back to a
 * soft local session so demo entry never dead-ends when mint is blocked (prod).
 */

import { getCustomerToken, loginAsCustomer } from '../auth.js';
import { setWalletTenantId, clearWalletTenantId } from '../wallet/walletTenantSeal.js';
import { markPreferRentLookup } from './preferRentLookup.js';

export const NATIVE_RENT_DEMO_KEY = 'poreiago_native_rent_demo_v1';
export const NATIVE_RENT_DEMO_EMAIL = 'demo-rent@poreiago.local';
/** Soft local token when office mint is unavailable — enough to open Wallet shell. */
export const NATIVE_RENT_DEMO_TOKEN = 'native-rent-demo';

/** IconaRent office — Ιψονα ρεντ / Dodopoulos… O.E. */
export const NATIVE_RENT_DEMO_OFFICE_SLUG = 'iconarent';
export const NATIVE_RENT_DEMO_OFFICE_HOST = 'iconarent.poreiago.com';
export const NATIVE_RENT_DEMO_API_BASE = `https://${NATIVE_RENT_DEMO_OFFICE_HOST}`;
/** Production tenant id fallback when session resolve fails. */
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

export function nativeRentDemoApiBase() {
  return NATIVE_RENT_DEMO_API_BASE;
}

/** Soft placeholder token — not a real JWT (browsing only). */
export function isSoftNativeRentDemoToken(token = getCustomerToken()) {
  return String(token || '').trim() === NATIVE_RENT_DEMO_TOKEN;
}

/**
 * Resolve IconaRent tenant_id from office appearance, else fallback.
 * @returns {Promise<string>}
 */
export async function resolveNativeRentDemoTenantId() {
  const fallback = NATIVE_RENT_DEMO_TENANT_FALLBACK;
  try {
    const res = await fetch(`${NATIVE_RENT_DEMO_API_BASE}/api/site/appearance`, {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const logo = String(data?.logo_url || data?.rent_logo_url || '');
    const hit = logo.match(/office-assets\/([0-9a-f-]{36})\//i);
    if (hit?.[1]) return hit[1];
  } catch {
    /* offline / CORS */
  }
  return fallback;
}

async function postNativeRentDemo(url) {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'omit',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Office-Host': NATIVE_RENT_DEMO_OFFICE_HOST,
    },
    body: '{}',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.detail;
    throw new Error(
      typeof detail === 'string' ? detail : `Demo rent login failed (${res.status})`,
    );
  }
  return data;
}

/**
 * Mint real JWT sealed to IconaRent (office host, then same-origin fallback).
 * @returns {Promise<{access_token: string, tenant_id: string, email: string, name: string}>}
 */
export async function fetchNativeRentDemoSession() {
  try {
    return await postNativeRentDemo(`${NATIVE_RENT_DEMO_API_BASE}/api/auth/native-rent-demo`);
  } catch (firstErr) {
    try {
      // Capacitor / same-origin proxy may allow mint when cross-office CORS fails.
      return await postNativeRentDemo('/api/auth/native-rent-demo');
    } catch {
      throw firstErr;
    }
  }
}

/**
 * Enter My Wallet rentals tab sealed to IconaRent.
 * @param {{ requireRealJwt?: boolean }} [opts]
 */
export async function enterNativeRentDemoWallet({ requireRealJwt = false } = {}) {
  enableNativeRentDemo();
  let profile = null;
  try {
    profile = await fetchNativeRentDemoSession();
  } catch {
    profile = null;
  }

  const tid =
    String(profile?.tenant_id || '').trim() ||
    (await resolveNativeRentDemoTenantId()) ||
    NATIVE_RENT_DEMO_TENANT_FALLBACK;

  try {
    if (tid) setWalletTenantId(tid);
    else clearWalletTenantId();
  } catch {
    /* ignore */
  }

  let token = String(profile?.access_token || '').trim();
  if (!token) {
    if (requireRealJwt) {
      throw new Error(
        'Το demo ενοικιάσεων χρειάζεται σύνδεση γραφείου — δοκίμασε ξανά ή κάνε κανονική είσοδο.',
      );
    }
    // Soft session: open Wallet shell + demo fleet even when production mint is disabled.
    token = NATIVE_RENT_DEMO_TOKEN;
  }

  loginAsCustomer(
    profile?.email || NATIVE_RENT_DEMO_EMAIL,
    {
      name: profile?.name || 'Demo Rent',
      provider: profile?.provider || 'demo',
      tenant_id: tid,
      customer_id: profile?.customer_id,
      picture: profile?.picture,
    },
    token,
  );
}

export function clearNativeRentDemo() {
  try {
    sessionStorage.removeItem(NATIVE_RENT_DEMO_KEY);
  } catch {
    /* ignore */
  }
}
