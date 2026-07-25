/**
 * My Wallet claim flow (phase A):
 * Guest can buy / look up a booking without a JWT, then create or sign in
 * to a real customer account to open /wallet.
 *
 * Phase B (later): email magic link that lands with a short-lived token.
 */

const STORAGE_KEY = 'wallet_claim_v1';

/**
 * @typedef {{
 *   email: string,
 *   name?: string,
 *   phone?: string,
 *   bookingId?: string,
 *   reference?: string,
 *   source: 'checkout' | 'lookup' | 'manual',
 *   createdAt: number,
 * }} WalletClaim
 */

/** @returns {WalletClaim | null} */
export function getWalletClaim() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.email) return null;
    // Drop stale claims after 7 days.
    if (parsed.createdAt && Date.now() - parsed.createdAt > 7 * 24 * 60 * 60 * 1000) {
      clearWalletClaim();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** @param {Partial<WalletClaim> & { email: string, source: WalletClaim['source'] }} claim */
export function saveWalletClaim(claim) {
  const email = String(claim.email || '')
    .trim()
    .toLowerCase();
  if (!email) return null;
  /** @type {WalletClaim} */
  const row = {
    email,
    name: claim.name ? String(claim.name).trim() : undefined,
    phone: claim.phone ? String(claim.phone).trim() : undefined,
    bookingId: claim.bookingId ? String(claim.bookingId) : undefined,
    reference: claim.reference ? String(claim.reference) : undefined,
    source: claim.source || 'manual',
    createdAt: Date.now(),
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(row));
    if (row.bookingId) sessionStorage.setItem('lastBookingId', row.bookingId);
  } catch {
    /* ignore quota */
  }
  return row;
}

export function clearWalletClaim() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Where to send a guest after purchase / lookup so they can open My Wallet.
 * Prefer register for first-time; login when they already have a soft session email.
 */
export function walletClaimAuthPath({ preferLogin = false } = {}) {
  return preferLogin ? '/login' : '/register';
}

/** Navigation state for Login / Register after a guest booking. */
export function walletClaimNavState(claim, { preferLogin = false } = {}) {
  if (!claim?.email) {
    return { from: '/wallet', walletClaim: true };
  }
  return {
    from: '/wallet',
    walletClaim: true,
    email: claim.email,
    name: claim.name || '',
    phone: claim.phone || '',
    highlightBooking: claim.bookingId || undefined,
    reference: claim.reference || undefined,
    preferLogin,
    claimSource: claim.source,
  };
}
