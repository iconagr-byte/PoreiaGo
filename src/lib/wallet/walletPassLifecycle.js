/**
 * Wallet «Remove Pass» — hide from this device (Apple Wallet style).
 * Does not cancel the office booking.
 */

import { walletOfficeStorageKey } from './walletTenantSeal.js';

export const WALLET_DISMISSED_PASSES_KEY = 'wallet_dismissed_passes_v1';

function dismissedKey() {
  return walletOfficeStorageKey(WALLET_DISMISSED_PASSES_KEY);
}

export function loadDismissedWalletPassIds() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(dismissedKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function dismissWalletPass(bookingIdOrIds) {
  if (typeof window === 'undefined') return loadDismissedWalletPassIds();
  const ids = (Array.isArray(bookingIdOrIds) ? bookingIdOrIds : [bookingIdOrIds])
    .filter(Boolean)
    .map(String);
  if (!ids.length) return loadDismissedWalletPassIds();
  const next = [...new Set([...loadDismissedWalletPassIds(), ...ids])];
  try {
    localStorage.setItem(dismissedKey(), JSON.stringify(next));
  } catch {
    /* quota */
  }
  return next;
}

export function clearDismissedWalletPass(bookingId) {
  if (typeof window === 'undefined' || !bookingId) return loadDismissedWalletPassIds();
  const id = String(bookingId);
  const next = loadDismissedWalletPassIds().filter((x) => x !== id);
  try {
    localStorage.setItem(dismissedKey(), JSON.stringify(next));
  } catch {
    /* quota */
  }
  return next;
}
