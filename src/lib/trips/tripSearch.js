import { getTripMarket, MARKET_DOMESTIC, MARKET_INTERNATIONAL } from './tripMarket.js';

export const MARKET_FILTER_ALL = 'all';
export const MARKET_FILTER_DOMESTIC = 'domestic';
export const MARKET_FILTER_INTERNATIONAL = 'international';

/**
 * @param {object} trip
 * @param {{ query?: string, market?: string, date?: string }} filters
 */
export function matchesTripSearch(trip, filters = {}) {
  const { query = '', market = MARKET_FILTER_ALL, date = '', tripId = '' } = filters;

  if (market === MARKET_FILTER_DOMESTIC && getTripMarket(trip) !== MARKET_DOMESTIC) {
    return false;
  }
  if (market === MARKET_FILTER_INTERNATIONAL && getTripMarket(trip) !== MARKET_INTERNATIONAL) {
    return false;
  }

  if (tripId && String(trip.id) !== String(tripId)) {
    return false;
  }

  if (query.trim()) {
    const q = query.trim().toLowerCase();
    const hay = `${trip.title || ''} ${trip.destination || ''} ${trip.hook || ''} ${trip.description || ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }

  if (date && trip.departureTime) {
    const dep = new Date(trip.departureTime).toISOString().slice(0, 10);
    if (dep !== date) return false;
  }

  return true;
}

export function sortTripsByDeparture(trips) {
  return [...trips].sort(
    (a, b) => new Date(a.departureTime || 0) - new Date(b.departureTime || 0),
  );
}

export function tripsForMarketFilter(trips, market) {
  if (market === MARKET_FILTER_DOMESTIC) {
    return trips.filter((t) => getTripMarket(t) === MARKET_DOMESTIC);
  }
  if (market === MARKET_FILTER_INTERNATIONAL) {
    return trips.filter((t) => getTripMarket(t) === MARKET_INTERNATIONAL);
  }
  return trips;
}

export function tripDepartureIso(trip) {
  if (!trip?.departureTime) return '';
  return new Date(trip.departureTime).toISOString().slice(0, 10);
}

export function formatTripDepartureLabel(trip) {
  if (!trip?.departureTime) return '—';
  return new Date(trip.departureTime).toLocaleDateString('el-GR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function filterTrips(trips, filters) {
  return trips.filter((t) => matchesTripSearch(t, filters));
}
