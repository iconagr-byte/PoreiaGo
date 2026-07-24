/**
 * Passenger self check-in + partner agency share tokens (unsigned base64url JSON).
 */
function toBase64Url(str) {
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(str) {
  const b64 = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return decodeURIComponent(escape(atob(b64 + pad)));
}

function encode(payload) {
  return toBase64Url(JSON.stringify(payload));
}

function decode(token) {
  try {
    return JSON.parse(fromBase64Url(token));
  } catch {
    return null;
  }
}

export function buildPassengerCheckinPayload(trip, seats = []) {
  return {
    v: 1,
    kind: 'passenger_checkin',
    id: trip?.id,
    title: trip?.title || 'Trip',
    passengers: (seats.length ? seats : trip?.passengerFlightSeats || []).map((s) => ({
      id: s.id,
      passenger_name: s.passenger_name,
      ground_seat: s.ground_seat,
      flight_seat: s.flight_seat,
      booking_id: s.booking_id,
    })),
  };
}

export function encodePassengerCheckin(trip, seats) {
  return encode(buildPassengerCheckinPayload(trip, seats));
}

export function decodePassengerCheckin(token) {
  const data = decode(token);
  if (!data || data.v !== 1 || data.kind !== 'passenger_checkin') return null;
  return data;
}

export function buildPassengerCheckinUrl(trip, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  const token = encodePassengerCheckin(trip);
  return token ? `${origin}/passenger-checkin#${token}` : '';
}

export function buildPartnerViewPayload(trip) {
  return {
    v: 1,
    kind: 'partner_view',
    id: trip?.id,
    title: trip?.title || 'Trip',
    currency: trip?.currency || 'EUR',
    departureTime: trip?.departureTime || '',
    crew: trip?.crew || {},
    flights: trip?.flights || [],
    segments: trip?.segments || [],
    passengerFlightSeats: (trip?.passengerFlightSeats || []).map((s) => ({
      passenger_name: s.passenger_name,
      ground_seat: s.ground_seat,
      flight_seat: s.flight_seat,
      pnr_code: s.pnr_code,
      ticket_code: s.ticket_code,
      flight_id: s.flight_id,
    })),
  };
}

export function encodePartnerView(trip) {
  return encode(buildPartnerViewPayload(trip));
}

export function decodePartnerView(token) {
  const data = decode(token);
  if (!data || data.v !== 1 || data.kind !== 'partner_view') return null;
  return data;
}

export function buildPartnerViewUrl(trip, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  const token = encodePartnerView(trip);
  return token ? `${origin}/partner/itinerary#${token}` : '';
}

/** Persist local passenger self check-in responses. */
const CHECKIN_KEY = 'poreiago_passenger_self_checkins_v1';

export function savePassengerSelfCheckin(tripId, entry) {
  let all;
  try {
    all = JSON.parse(localStorage.getItem(CHECKIN_KEY) || '{}') || {};
  } catch {
    all = {};
  }
  if (!all || typeof all !== 'object') all = {};
  const tid = String(tripId);
  const list = Array.isArray(all[tid]) ? all[tid] : [];
  const idx = list.findIndex(
    (x) => x.passenger_id === entry.passenger_id || x.passenger_name === entry.passenger_name,
  );
  const row = { ...entry, at: new Date().toISOString() };
  if (idx >= 0) list[idx] = { ...list[idx], ...row };
  else list.push(row);
  all[tid] = list;
  localStorage.setItem(CHECKIN_KEY, JSON.stringify(all));
  return list;
}

export function listPassengerSelfCheckins(tripId) {
  try {
    const all = JSON.parse(localStorage.getItem(CHECKIN_KEY) || '{}') || {};
    return Array.isArray(all[String(tripId)]) ? all[String(tripId)] : [];
  } catch {
    return [];
  }
}
