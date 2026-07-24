import { mockTrips } from '../../data/mockData.js';
import {
  getTripMarket,
  MARKET_DOMESTIC,
  MARKET_INTERNATIONAL,
  normalizeTrip,
} from './tripMarket.js';
import { normalizeHybridTripFields } from '../hybrid/hybridDefaults.js';
import { appendHybridChange, summarizeHybridDiff } from '../hybrid/changeLog.js';
import { syncTripToPostgres } from '../../services/tripsSyncApi.js';
import { syncHybridTripToServer } from '../../services/hybridTripApi.js';
import {
  isAuthenticatedOfficeSession,
  officeStorageKey,
} from '../admin/officeTenantStore.js';

const STORAGE_KEY_BASE = 'aerostride_trips_v1';

function storageKey() {
  return officeStorageKey(STORAGE_KEY_BASE);
}

export function loadTrips() {
  let base;
  try {
    const raw = localStorage.getItem(storageKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) base = parsed.map(normalizeTrip);
      if (Array.isArray(parsed) && parsed.length === 0 && isAuthenticatedOfficeSession()) {
        return [];
      }
    }
  } catch {
    /* ignore */
  }

  // Authenticated office: never inject platform demo trips.
  if (isAuthenticatedOfficeSession()) {
    return Array.isArray(base) ? base.map(normalizeTrip) : [];
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
  localStorage.setItem(storageKey(), JSON.stringify(trips));
}

export function getTripById(tripId) {
  const id = Number(tripId);
  return loadTrips().find((t) => t.id === id) || null;
}

export function upsertTrip(trip) {
  const trips = loadTrips();
  const normalized = normalizeTrip(trip);
  const idx = trips.findIndex((t) => t.id === normalized.id);
  const previous = idx >= 0 ? trips[idx] : null;
  const withLog = {
    ...normalized,
    hybridChangeLog: appendHybridChange(normalized, {
      actor: 'office',
      action: previous ? 'update' : 'create',
      summary: summarizeHybridDiff(previous, normalized),
    }),
  };
  if (idx >= 0) {
    trips[idx] = { ...trips[idx], ...withLog };
  } else {
    trips.push(withLog);
  }
  saveTrips(trips);
  syncTripToPostgres(withLog);
  syncHybridTripToServer(withLog);
  return withLog;
}

export function deleteTrip(tripId) {
  const id = Number(tripId);
  const trips = loadTrips().filter((t) => t.id !== id);
  saveTrips(trips);
}

export function createEmptyTripForm(defaultMarket = MARKET_DOMESTIC) {
  const market =
    defaultMarket === MARKET_INTERNATIONAL ? MARKET_INTERNATIONAL : MARKET_DOMESTIC;
  return normalizeHybridTripFields({
    title: '',
    market,
    destination: '',
    departureTime: '',
    arrivalTime: '',
    price: 0,
    childPrice: '',
    vehicleType: 'Luxury Coach',
    availableSeats: 30,
    totalSeats: 30,
    description: '',
    driverId: '',
    driverName: '',
    vehiclePlate: '',
    vehicleCode: '',
    image: '',
    hook: '',
    durationLabel: 'Ημερήσια',
    badge: '',
    featured: false,
    status: 'published',
    meetingPoint: '',
    highlights: [],
    stops: [],
    currency: 'EUR',
    targetMarginPct: 25,
    connectionThresholdMin: 90,
    airportBuffers: {},
    crew: { tourLeader: '', driverName: '', guideName: '' },
    hybridChangeLog: [],
    flights: [],
    segments: [],
    passengerFlightSeats: [],
    luggageCheckins: [],
  });
}

export function tripToFormData(trip) {
  if (!trip) return createEmptyTripForm();
  return normalizeHybridTripFields({
    ...trip,
    departureTime: trip.departureTime ? trip.departureTime.substring(0, 16) : '',
    arrivalTime: trip.arrivalTime ? trip.arrivalTime.substring(0, 16) : '',
    stops: trip.stops ? [...trip.stops] : [],
    flights: trip.flights ? [...trip.flights] : [],
    segments: trip.segments ? [...trip.segments] : [],
    passengerFlightSeats: trip.passengerFlightSeats ? [...trip.passengerFlightSeats] : [],
    luggageCheckins: trip.luggageCheckins ? [...trip.luggageCheckins] : [],
  });
}

export function formDataToTrip(formData, existingId = null) {
  const highlights = Array.isArray(formData.highlights)
    ? formData.highlights.map((h) => String(h).trim()).filter(Boolean)
    : String(formData.highlights || '')
        .split(/[\n,]/)
        .map((h) => h.trim())
        .filter(Boolean);

  const childRaw = formData.childPrice;
  const childPrice =
    childRaw === '' || childRaw === null || childRaw === undefined
      ? null
      : Number(childRaw);

  return normalizeTrip({
    ...formData,
    id: existingId ?? Date.now(),
    price: Number(formData.price) || 0,
    childPrice: Number.isFinite(childPrice) ? childPrice : null,
    availableSeats: Number(formData.availableSeats) || 0,
    totalSeats: Number(formData.totalSeats || formData.availableSeats) || 0,
    featured: Boolean(formData.featured),
    status: formData.status === 'draft' ? 'draft' : 'published',
    durationLabel: String(formData.durationLabel || '').trim(),
    badge: String(formData.badge || '').trim(),
    meetingPoint: String(formData.meetingPoint || '').trim(),
    highlights,
    currency: formData.currency || 'EUR',
    targetMarginPct: Number(formData.targetMarginPct) || 25,
    connectionThresholdMin: Number(formData.connectionThresholdMin) || 90,
    airportBuffers:
      formData.airportBuffers && typeof formData.airportBuffers === 'object'
        ? formData.airportBuffers
        : {},
    crew: formData.crew || {},
    hybridChangeLog: Array.isArray(formData.hybridChangeLog) ? formData.hybridChangeLog : [],
    flights: Array.isArray(formData.flights) ? formData.flights : [],
    segments: Array.isArray(formData.segments) ? formData.segments : [],
    passengerFlightSeats: Array.isArray(formData.passengerFlightSeats)
      ? formData.passengerFlightSeats
      : [],
    luggageCheckins: Array.isArray(formData.luggageCheckins) ? formData.luggageCheckins : [],
    departureTime: formData.departureTime ? new Date(formData.departureTime).toISOString() : '',
    arrivalTime: formData.arrivalTime ? new Date(formData.arrivalTime).toISOString() : '',
  });
}

/** Storefront: hide drafts. */
export function isPublishedTrip(trip) {
  return !trip || trip.status !== 'draft';
}

export function listPublishedTrips(trips = loadTrips()) {
  return trips.filter(isPublishedTrip);
}
