/**
 * My Wallet → real booking flow helpers (seat map → extras → checkout).
 * Keep tenant-scoped via sealed office + resolvePublicOfficeTrip on those pages.
 */

/** Location state so seat/checkout «Πίσω» returns to Wallet Αρχική. */
export function walletBookNavState() {
  return { fromWallet: true };
}

export function walletSelectSeatPath(tripId) {
  const id = Number(tripId);
  if (!Number.isFinite(id) || id <= 0) return '/wallet';
  return `/select-seat/${id}`;
}

export function isWalletBookFlow(locationState) {
  return Boolean(locationState && locationState.fromWallet);
}
