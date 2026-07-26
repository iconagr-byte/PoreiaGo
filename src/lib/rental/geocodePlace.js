/**
 * Resolve free-text rental pickup/dropoff places to lat/lng (Greece-first).
 */
import { GREECE_CITIES, GREECE_REGIONS } from '../maps/greecePlaces.js';

const OFFICE_DEFAULT = { lat: 37.9838, lng: 23.7275, label: 'Γραφείο' };

const ALIASES = {
  γραφειο: OFFICE_DEFAULT,
  γραφείο: OFFICE_DEFAULT,
  office: OFFICE_DEFAULT,
  hq: OFFICE_DEFAULT,
  αεροδρομιο: { lat: 37.9364, lng: 23.9445, label: 'Αεροδρόμιο' },
  αεροδρόμιο: { lat: 37.9364, lng: 23.9445, label: 'Αεροδρόμιο' },
  'ελευθέριος βενιζέλος': { lat: 37.9364, lng: 23.9445, label: 'Αεροδρόμιο' },
  ath: { lat: 37.9364, lng: 23.9445, label: 'Αεροδρόμιο' },
  athens: { lat: 37.9838, lng: 23.7275, label: 'Αθήνα' },
  αθηνα: { lat: 37.9838, lng: 23.7275, label: 'Αθήνα' },
  αθήνα: { lat: 37.9838, lng: 23.7275, label: 'Αθήνα' },
  πειραιας: { lat: 37.942, lng: 23.646, label: 'Πειραιάς' },
  πειραιάς: { lat: 37.942, lng: 23.646, label: 'Πειραιάς' },
  λιμανι: { lat: 37.942, lng: 23.646, label: 'Λιμάνι' },
  λιμάνι: { lat: 37.942, lng: 23.646, label: 'Λιμάνι' },
};

const memoryCache = new Map();

function normalize(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function matchLocal(place) {
  const raw = String(place || '').trim();
  if (!raw) return { ...OFFICE_DEFAULT, source: 'default' };

  const key = normalize(raw);
  if (ALIASES[key]) return { ...ALIASES[key], source: 'alias' };
  if (ALIASES[raw.toLowerCase()]) return { ...ALIASES[raw.toLowerCase()], source: 'alias' };

  const pool = [...GREECE_CITIES, ...GREECE_REGIONS];
  const exact = pool.find((p) => normalize(p.name) === key);
  if (exact) return { lat: exact.lat, lng: exact.lng, label: exact.name, source: 'places' };

  const partial = pool.find(
    (p) => key.includes(normalize(p.name)) || normalize(p.name).includes(key),
  );
  if (partial) return { lat: partial.lat, lng: partial.lng, label: partial.name, source: 'places' };

  return null;
}

async function nominatim(place) {
  const q = String(place || '').trim();
  if (!q) return null;
  const url =
    `https://nominatim.openstreetmap.org/search?` +
    new URLSearchParams({
      q: `${q}, Ελλάδα`,
      format: 'json',
      limit: '1',
      countrycodes: 'gr',
    });
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    const hit = Array.isArray(rows) ? rows[0] : null;
    if (!hit?.lat || !hit?.lon) return null;
    return {
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      label: hit.display_name?.split(',')[0] || q,
      source: 'nominatim',
    };
  } catch {
    return null;
  }
}

/** Sync resolve for known aliases / cities — never returns null. */
export function resolvePlaceSync(place) {
  const raw = String(place || '').trim() || 'Γραφείο';
  const cacheKey = normalize(raw) || 'γραφειο';
  if (memoryCache.has(cacheKey)) return memoryCache.get(cacheKey);
  const local = matchLocal(raw);
  if (local) {
    memoryCache.set(cacheKey, local);
    return local;
  }
  return { ...OFFICE_DEFAULT, label: raw, source: 'fallback' };
}

/** Normalize booking locations so empty pickup becomes Γραφείο. */
export function placesFromBookings(bookings) {
  const places = new Set();
  for (const b of bookings || []) {
    places.add(String(b?.pickup_location || '').trim() || 'Γραφείο');
    const drop = String(b?.dropoff_location || '').trim();
    if (drop) places.add(drop);
  }
  if (!places.size && (bookings || []).length) places.add('Γραφείο');
  return [...places];
}

/** @returns {Promise<{ lat: number, lng: number, label: string, source: string }>} */
export async function geocodePlace(place) {
  const raw = String(place || '').trim() || 'Γραφείο';
  const cacheKey = normalize(raw) || 'γραφειο';
  if (memoryCache.has(cacheKey)) return memoryCache.get(cacheKey);

  const local = matchLocal(raw);
  if (local) {
    memoryCache.set(cacheKey, local);
    return local;
  }

  const remote = await nominatim(raw);
  const resolved = remote || { ...OFFICE_DEFAULT, label: raw, source: 'fallback' };
  memoryCache.set(cacheKey, resolved);
  return resolved;
}

/** Geocode unique places with light concurrency. */
export async function geocodePlaces(places) {
  const unique = [
    ...new Set((places || []).map((p) => String(p || '').trim() || 'Γραφείο').filter(Boolean)),
  ];
  const out = new Map();
  for (const place of unique) {
    // Sequential to respect Nominatim rate limits.
    const resolved = await geocodePlace(place);
    out.set(place, resolved);
  }
  return out;
}

/** Slight offset so overlapping bookings at the same place remain clickable. */
export function jitterLatLng(lat, lng, index, total = 1) {
  if (!total || total < 2) return { lat, lng };
  const angle = (index / total) * Math.PI * 2;
  const radius = 0.0022; // ~200m
  return {
    lat: lat + Math.sin(angle) * radius,
    lng: lng + Math.cos(angle) * radius,
  };
}
