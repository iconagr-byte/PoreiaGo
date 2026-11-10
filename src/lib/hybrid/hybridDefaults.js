import { newClientId } from './costYieldCalculator.js';
import { emptyCrew } from './changeLog.js';

export const SEGMENT_TYPE_OPTIONS = [
  { value: 'hotel_transfer', label: 'Μεταφορά ξενοδοχείου', icon: 'hotel' },
  { value: 'bus', label: 'Λεωφορείο', icon: 'directions_bus' },
  { value: 'van', label: 'Van', icon: 'airport_shuttle' },
  { value: 'ground_transfer', label: 'Ground transfer', icon: 'local_taxi' },
  { value: 'flight', label: 'Πτήση', icon: 'flight' },
  { value: 'local_transfer', label: 'Τοπική μεταφορά', icon: 'directions_car' },
  { value: 'layover', label: 'Αναμονή / layover', icon: 'schedule' },
  { value: 'other', label: 'Άλλο', icon: 'more_horiz' },
];

export function emptyFlight(overrides = {}) {
  return {
    id: newClientId('flt'),
    flight_number: '',
    airline: '',
    departure_airport: '',
    arrival_airport: '',
    departure_time: '',
    arrival_time: '',
    pnr_code: '',
    seats_allocated: 0,
    cost_per_seat: 0,
    total_cost: 0,
    currency: 'EUR',
    status: 'scheduled',
    delay_minutes: 0,
    notes: '',
    ...overrides,
  };
}

export function emptySegment(overrides = {}) {
  return {
    id: newClientId('seg'),
    sequence: 0,
    segment_type: 'ground_transfer',
    title: '',
    starts_at: '',
    ends_at: '',
    flight_id: null,
    vehicle_ref: '',
    origin_label: '',
    destination_label: '',
    ground_cost: 0,
    currency: 'EUR',
    metadata: {},
    ...overrides,
  };
}

export function emptyPassengerSeat(overrides = {}) {
  return {
    id: newClientId('pax'),
    flight_id: '',
    booking_id: '',
    passenger_name: '',
    ground_seat: '',
    flight_seat: '',
    ticket_code: '',
    pnr_code: '',
    ...overrides,
  };
}

export function normalizeHybridTripFields(trip) {
  if (!trip) return trip;
  const flights = Array.isArray(trip.flights) ? trip.flights : [];
  const segments = Array.isArray(trip.segments)
    ? [...trip.segments].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    : [];
  return {
    ...trip,
    currency: trip.currency || 'EUR',
    targetMarginPct: trip.targetMarginPct ?? 25,
    connectionThresholdMin: trip.connectionThresholdMin ?? 90,
    airportBuffers:
      trip.airportBuffers && typeof trip.airportBuffers === 'object' ? trip.airportBuffers : {},
    crew: { ...emptyCrew(), ...(trip.crew || {}) },
    hybridChangeLog: Array.isArray(trip.hybridChangeLog) ? trip.hybridChangeLog : [],
    roomingList: Array.isArray(trip.roomingList) ? trip.roomingList : [],
    passengerExtras: Array.isArray(trip.passengerExtras) ? trip.passengerExtras : [],
    supplierCostSheets: Array.isArray(trip.supplierCostSheets) ? trip.supplierCostSheets : [],
    fxRatesToEur: trip.fxRatesToEur && typeof trip.fxRatesToEur === 'object' ? trip.fxRatesToEur : undefined,
    flights,
    segments,
    passengerFlightSeats: Array.isArray(trip.passengerFlightSeats) ? trip.passengerFlightSeats : [],
    luggageCheckins: Array.isArray(trip.luggageCheckins) ? trip.luggageCheckins : [],
  };
}
