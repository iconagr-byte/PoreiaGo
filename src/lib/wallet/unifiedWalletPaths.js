/**
 * One My Wallet shell for bus tickets + rent passes.
 * Legacy /rent/wallet deep-links redirect here with ?tab=rentals.
 */

export const UNIFIED_WALLET_PATH = '/wallet';
export const UNIFIED_WALLET_RENTALS_PATH = '/wallet?tab=rentals';

/** @param {'wallet'|'rent'|string|null|undefined} role */
export function walletPathForRole(role) {
  if (role === 'rent') return UNIFIED_WALLET_RENTALS_PATH;
  return UNIFIED_WALLET_PATH;
}

export function isWalletRentalsPath(pathname, search = '') {
  if (pathname !== '/wallet' && pathname !== '/rent/wallet') return false;
  if (pathname === '/rent/wallet') return true;
  try {
    return new URLSearchParams(search || '').get('tab') === 'rentals';
  } catch {
    return false;
  }
}
