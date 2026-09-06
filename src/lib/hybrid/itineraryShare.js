/**
 * Shared / public hybrid itinerary encoding (local-first, no server required).
 * Payload is base64url JSON — suitable for read-only share links.
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

export function buildItinerarySharePayload(trip) {
  if (!trip) return null;
  return {
    v: 1,
    id: trip.id,
    title: trip.title || 'Hybrid trip',
    currency: trip.currency || 'EUR',
    departureTime: trip.departureTime || trip.departure_time || '',
    flights: (trip.flights || []).map((f) => ({
      id: f.id,
      flight_number: f.flight_number,
      airline: f.airline,
      departure_airport: f.departure_airport,
      arrival_airport: f.arrival_airport,
      departure_time: f.departure_time,
      arrival_time: f.arrival_time,
      pnr_code: f.pnr_code,
      status: f.status,
      delay_minutes: f.delay_minutes || 0,
    })),
    segments: (trip.segments || []).map((s) => ({
      id: s.id,
      sequence: s.sequence,
      segment_type: s.segment_type,
      title: s.title,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      origin_label: s.origin_label,
      destination_label: s.destination_label,
      vehicle_ref: s.vehicle_ref,
      flight_id: s.flight_id,
      metadata: s.metadata || {},
    })),
  };
}

export function encodeItineraryShare(trip) {
  const payload = buildItinerarySharePayload(trip);
  if (!payload) return '';
  return toBase64Url(JSON.stringify(payload));
}

export function decodeItineraryShare(token) {
  try {
    const json = fromBase64Url(token);
    const data = JSON.parse(json);
    if (!data || data.v !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function buildItineraryShareUrl(trip, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  const token = encodeItineraryShare(trip);
  if (!token) return '';
  return `${origin}/itinerary/share#${token}`;
}
