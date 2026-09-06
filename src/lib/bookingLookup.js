import { loadBookings, addBooking } from './ticketing/bookingStore.js';
import { mapSaasBookingToLocal } from './ticketing/bookingMerge.js';
import { getSaasTenantId, saasLookupGuestBooking } from '../services/saasApi.js';
import { getCustomerToken, isCustomer } from './auth.js';
import { saveWalletClaim } from './wallet/walletClaim.js';

/** @returns {string[]} */
export function referenceVariants(raw) {
  let c = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!c) return [];

  const variants = new Set([c]);
  while (c.startsWith('B-') && !c.startsWith('BK-')) {
    c = c.slice(2);
    variants.add(c);
  }
  if (!c.startsWith('BK-')) {
    variants.add(`BK-${c.replace(/^BK-?/, '')}`);
  }
  variants.add(c.replace(/^BK-/, ''));
  return [...variants];
}

/** @param {import('./ticketing/bookingStore.js').BookingRecord} booking */
function bookingRefCandidates(booking) {
  const ids = [
    booking.pnr,
    booking.id,
    booking.saasBookingId,
    String(booking.id || '').replace(/^B-/, ''),
  ].filter(Boolean);
  return [...new Set(ids.flatMap((x) => referenceVariants(x)))];
}

/**
 * @param {string} email
 * @param {string} referenceCode
 */
export function findLocalBookingByEmailAndRef(email, referenceCode) {
  const normEmail = email.trim().toLowerCase();
  const wanted = new Set(referenceVariants(referenceCode));
  if (!normEmail || !wanted.size) return null;

  return (
    loadBookings().find((b) => {
      if (String(b.email || '').toLowerCase() !== normEmail) return false;
      return bookingRefCandidates(b).some((r) => wanted.has(r));
    }) ?? null
  );
}

/**
 * @param {{ email: string, referenceCode: string }} input
 * @returns {Promise<import('./ticketing/bookingStore.js').BookingRecord | null>}
 */
export async function lookupGuestBooking({ email, referenceCode }) {
  const tenantId = getSaasTenantId() || undefined;
  try {
    const row = await saasLookupGuestBooking({
      tenantId,
      email,
      referenceCode,
    });
    const mapped = mapSaasBookingToLocal(row);
    const existing = findLocalBookingByEmailAndRef(email, referenceCode);
    if (!existing) addBooking(mapped);
    return existing ? { ...existing, ...mapped } : mapped;
  } catch (err) {
    const msg = String(err.message || '');
    const notFound =
      msg.includes('Δεν βρέθηκε') || msg.includes('404') || msg.includes('not found');
    if (!notFound) {
      console.warn('[lookup] SaaS failed, trying local', err);
    }
  }

  return findLocalBookingByEmailAndRef(email, referenceCode);
}

/**
 * Prepare a looked-up booking for My Wallet.
 * Returns whether the customer already has a real JWT session for /wallet.
 *
 * @param {import('./ticketing/bookingStore.js').BookingRecord} booking
 * @param {string} email
 * @returns {{ hasWalletSession: boolean, claim: object | null }}
 */
export function openBookingInWallet(booking, email) {
  const cleanEmail = String(email || '')
    .trim()
    .toLowerCase();
  if (booking?.id) {
    try {
      sessionStorage.setItem('lastBookingId', booking.id);
    } catch {
      /* ignore */
    }
  }

  const hasWalletSession = Boolean(isCustomer() && getCustomerToken());
  if (hasWalletSession) {
    return { hasWalletSession: true, claim: null };
  }

  const claim = saveWalletClaim({
    email: cleanEmail,
    name: booking?.passengerName || booking?.name || '',
    phone: booking?.phone || '',
    bookingId: booking?.id,
    reference: booking?.pnr || booking?.id,
    source: 'lookup',
  });
  return { hasWalletSession: false, claim };
}
