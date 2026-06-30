export const MARKET_DOMESTIC = 'domestic';
export const MARKET_INTERNATIONAL = 'international';

export const MARKET_LABELS = {
  [MARKET_DOMESTIC]: 'Ελλάδα',
  [MARKET_INTERNATIONAL]: 'Εξωτερικό',
};

/** Resolve market from trip record (supports legacy `category: international`). */
export function getTripMarket(trip) {
  if (!trip) return MARKET_DOMESTIC;
  if (trip.market === MARKET_INTERNATIONAL || trip.market === MARKET_DOMESTIC) {
    return trip.market;
  }
  if (trip.category === 'international') return MARKET_INTERNATIONAL;
  return MARKET_DOMESTIC;
}

export function isInternationalTrip(trip) {
  return getTripMarket(trip) === MARKET_INTERNATIONAL;
}

/** Ensure `market` is set; keep legacy `category` in sync for older code paths. */
export function normalizeTrip(trip) {
  if (!trip) return trip;
  const market = getTripMarket(trip);
  return {
    ...trip,
    market,
    ...(market === MARKET_INTERNATIONAL ? { category: 'international' } : {}),
  };
}
