import { mockTrips } from '../../data/mockData.js';
import {
  getTripMarket,
  MARKET_DOMESTIC,
  MARKET_INTERNATIONAL,
  normalizeTrip,
} from './tripMarket.js';
import { syncTripToPostgres } from '../../services/tripsSyncApi.js';

const STORAGE_KEY = 'aerostride_trips_v1';

export function loadTrips() {
  let base;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) base = parsed.map(normalizeTrip);
    }
  } catch {
    /* ignore */
  }
  if (!base) return mockTrips.map(normalizeTrip);

  const ids = new Set(base.map((t) => t.id));
  const missingIntl = mockTrips.filter(
    (t) => getTripMarket(t) === MARKET_INTERNATIONAL && !ids.has(t.id),
  );
  const merged = missingIntl.length ? [...base, ...missingIntl.map(normalizeTrip)] : base;
  return merged.map(normalizeTrip);
}

export function saveTrips(trips) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

export function getTripById(tripId) {
  const id = Number(tripId);
  return loadTrips().find((t) => t.id === id) || null;
}

export function upsertTrip(trip) {
  const trips = loadTrips();
  const normalized = normalizeTrip(trip);
  const idx = trips.findIndex((t) => t.id === normalized.id);
  if (idx >= 0) {
    trips[idx] = { ...trips[idx], ...normalized };
  } else {
    trips.push(normalized);
  }
  saveTrips(trips);
  syncTripToPostgres(normalized);
  return normalized;
}

export function deleteTrip(tripId) {
  const id = Number(tripId);
  const trips = loadTrips().filter((t) => t.id !== id);
  saveTrips(trips);
}

export function createEmptyTripForm(defaultMarket = MARKET_DOMESTIC) {
  const market =
    defaultMarket === MARKET_INTERNATIONAL ? MARKET_INTERNATIONAL : MARKET_DOMESTIC;
  return {
    title: '',
    market,
    destination: '',
    departureTime: '',
    arrivalTime: '',
    price: 0,
    vehicleType: 'Luxury Coach',
    availableSeats: 30,
    description: '',
    driverId: '',
    driverName: '',
    vehiclePlate: '',
    vehicleCode: '',
    image: '',
    hook: '',
    stops: [],
  };
}

export function tripToFormData(trip) {
  if (!trip) return createEmptyTripForm();
  return {
    ...trip,
    departureTime: trip.departureTime ? trip.departureTime.substring(0, 16) : '',
    arrivalTime: trip.arrivalTime ? trip.arrivalTime.substring(0, 16) : '',
    stops: trip.stops ? [...trip.stops] : [],
  };
}

export function formDataToTrip(formData, existingId = null) {
  return normalizeTrip({
    ...formData,
    id: existingId ?? Date.now(),
    price: Number(formData.price),
    availableSeats: Number(formData.availableSeats),
    departureTime: formData.departureTime ? new Date(formData.departureTime).toISOString() : '',
    arrivalTime: formData.arrivalTime ? new Date(formData.arrivalTime).toISOString() : '',
  });
}
