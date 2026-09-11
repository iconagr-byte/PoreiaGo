import { mockTrips } from '../../data/mockData.js';
import {
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
import { isPlatformMarketingHost, isTenantStorefrontHost } from '../platform/tenantHost.js';
import { stripDemoTrips } from '../admin/demoCatalog.js';

const STORAGE_KEY_BASE = 'aerostride_trips_v1';

function storageKey() {
  return officeStorageKey(STORAGE_KEY_BASE);
}

/**
 * Admin / authenticated office trip list (localStorage, tenant-scoped).
 * Public storefronts must use fetchPublicOfficeTrips() instead — never this.
 */
export function loadTrips() {
  // Public tenant office domains: never read shared browser catalog or mocks.
  // StorefrontDemoPage loads /api/site/trips (Host → tenant).
  if (!isAuthenticatedOfficeSession() && isTenantStorefrontHost()) {
    return [];
  }

  let base;
  try {
    const key = storageKey();
    let raw = localStorage.getItem(key);
    // Migrate unscoped legacy trips into the tenant key when scoped storage is empty.
    if (
      isAuthenticatedOfficeSession() &&
      key !== STORAGE_KEY_BASE &&
      (raw == null || raw === '' || raw === '[]')
    ) {
      const legacy = localStorage.getItem(STORAGE_KEY_BASE);
      if (legacy && legacy !== '[]') {
        try {
          const parsedLegacy = JSON.parse(legacy);
          if (Array.isArray(parsedLegacy) && parsedLegacy.length) {
            localStorage.setItem(key, legacy);
            localStorage.removeItem(STORAGE_KEY_BASE);
            raw = legacy;
          }
        } catch {
          /* ignore */
        }
      }
    }
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

  // Authenticated office: never inject platform demo trips; strip any leftover demos.
  if (isAuthenticatedOfficeSession()) {
    const officeTrips = stripDemoTrips(Array.isArray(base) ? base.map(normalizeTrip) : []);
    if (Array.isArray(base) && officeTrips.length !== base.length) {
      try {
        saveTrips(officeTrips);
      } catch {
        /* ignore */
      }
    }
    return officeTrips;
  }

  // Marketing host: curated trips so /trip/:id works from homepage cards.
  if (!base) {
    if (isPlatformMarketingHost() && !isTenantStorefrontHost()) {
      return loadPlatformDemoTrips();
    }
    return [];
  }
  return base.map(normalizeTrip);
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
  // Rebuild public catalog without the deleted trip.
  import('../../services/tripsSyncApi.js')
    .then(({ syncTripsToPostgres }) => syncTripsToPostgres(trips, { replaceCatalog: true, pruneMissing: true }))
    .catch(() => {});
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
    /** Extra coaches beyond the primary driver/vehicle pair. */
    additionalFleet: [],
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
    roomingList: [],
    passengerExtras: [],
    supplierCostSheets: [],
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
    additionalFleet: Array.isArray(trip.additionalFleet)
      ? trip.additionalFleet.map((row) => ({
          driverId: row.driverId || '',
          driverName: row.driverName || '',
          vehicleType: row.vehicleType || 'Luxury Coach',
          vehiclePlate: row.vehiclePlate || '',
          vehicleCode: row.vehicleCode || '',
        }))
      : [],
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
    roomingList: Array.isArray(formData.roomingList) ? formData.roomingList : [],
    passengerExtras: Array.isArray(formData.passengerExtras) ? formData.passengerExtras : [],
    supplierCostSheets: Array.isArray(formData.supplierCostSheets)
      ? formData.supplierCostSheets
      : [],
    fxRatesToEur: formData.fxRatesToEur,
    rebookSuggestion: formData.rebookSuggestion || null,
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

/** Curated demo trips for PoreiaGo marketing host (prospective buyers). */
export function loadPlatformDemoTrips() {
  return mockTrips.map(normalizeTrip);
}

/** Map a server catalog / Postgres trip row into local tripStore shape. */
export function catalogTripToLocal(row) {
  if (!row || typeof row !== 'object') return null;
  const id = Number(row.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  const statusRaw = String(row.status || row.state || 'published').toLowerCase();
  const status = statusRaw === 'draft' ? 'draft' : 'published';
  return normalizeTrip({
    id,
    title: row.title || '',
    destination: row.destination || '',
    departureTime: row.departureTime || row.departure_time || '',
    arrivalTime: row.arrivalTime || row.arrival_time || '',
    price: row.price ?? row.base_price ?? 0,
    childPrice: row.childPrice ?? row.child_price ?? null,
    availableSeats: row.availableSeats ?? row.available_seats ?? 0,
    totalSeats: row.totalSeats ?? row.total_seats ?? row.capacity ?? 30,
    description: row.description || '',
    image: row.image || row.image_url || '',
    hook: row.hook || '',
    durationLabel: row.durationLabel || row.duration_label || '',
    badge: row.badge || '',
    featured: Boolean(row.featured),
    status,
    meetingPoint: row.meetingPoint || row.meeting_point || '',
    highlights: Array.isArray(row.highlights) ? row.highlights : [],
    stops: Array.isArray(row.stops) ? row.stops : [],
    market: row.market || null,
    vehicleType: row.vehicleType || row.vehicle_type || '',
    currency: row.currency || 'EUR',
  });
}

/**
 * Merge server catalog trips into localStorage without dropping richer local rows.
 * Local wins on field conflicts; server fills missing ids (recovery after cache wipe).
 * @returns {{ trips: object[], added: number, total: number }}
 */
export function mergeServerTripsIntoStore(serverTrips) {
  const local = loadTrips();
  const byId = new Map();
  for (const t of local) {
    if (t?.id != null) byId.set(Number(t.id), t);
  }
  let added = 0;
  for (const raw of serverTrips || []) {
    const mapped = catalogTripToLocal(raw);
    if (!mapped) continue;
    const id = Number(mapped.id);
    if (!byId.has(id)) {
      byId.set(id, mapped);
      added += 1;
    } else {
      // Fill blank local fields from server without overwriting office edits.
      const cur = byId.get(id);
      const merged = { ...mapped, ...cur };
      for (const [k, v] of Object.entries(mapped)) {
        if (cur[k] == null || cur[k] === '') merged[k] = v;
      }
      byId.set(id, normalizeTrip(merged));
    }
  }
  const trips = stripDemoTrips([...byId.values()].sort((a, b) => Number(a.id) - Number(b.id)));
  saveTrips(trips);
  return { trips, added, total: trips.length };
}
