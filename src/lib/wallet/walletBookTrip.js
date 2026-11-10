/**
 * My Wallet → real booking flow helpers (seat map → extras → checkout).
 * Keep tenant-scoped via sealed office + resolvePublicOfficeTrip on those pages.
 */

/**
 * Location state so seat/checkout «Πίσω» returns to Wallet Αρχική.
 * Optionally seeds the published trip so seat map works even if API/cache miss.
 *
 * @param {object} [trip] published office trip from Wallet feed
 */
export function walletBookNavState(trip) {
  const state = { fromWallet: true };
  if (trip && trip.id != null) {
    state.officeTrip = trip;
  }
  return state;
}

export function walletSelectSeatPath(tripId) {
  const id = Number(tripId);
  if (!Number.isFinite(id) || id <= 0) return '/wallet';
  return `/select-seat/${id}`;
}

export function isWalletBookFlow(locationState) {
  if (locationState && locationState.fromWallet) return true;
  // Pending checkout stamped during seat select (survives lost nav state).
  try {
    if (typeof sessionStorage === 'undefined') return false;
    const raw = sessionStorage.getItem('pendingCheckout');
    if (!raw) return false;
    const pending = JSON.parse(raw);
    return Boolean(pending?.fromWallet);
  } catch {
    return false;
  }
}

/**
 * Trip carried from Wallet Κράτηση (avoids bounce when resolvePublicOfficeTrip misses).
 * @param {object|null|undefined} locationState
 * @param {string|number|undefined} tripId
 */
export function officeTripFromWalletState(locationState, tripId) {
  const seeded = locationState?.officeTrip;
  if (!seeded || seeded.id == null) return null;
  const want = Number(tripId);
  const got = Number(seeded.id);
  if (!Number.isFinite(want) || want <= 0 || got !== want) return null;
  return seeded;
}
