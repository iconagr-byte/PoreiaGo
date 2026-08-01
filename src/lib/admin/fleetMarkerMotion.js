/** Marker motion for the office live map — keep pins on the freshest fix. */

export const FLEET_MARKER_ANIM_MS = 1200;

/** Ignore sub-meter GPS jitter so 1s polls do not restart animation. */
export const FLEET_MARKER_MIN_MOVE_M = 1.5;

/** Snap instantly when the new fix is far from the last target (tunnel / cold start). */
export const FLEET_MARKER_SNAP_M = 120;

const EARTH_R_M = 6371000;

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * EARTH_R_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Ease-out quad — matches useAnimatedFleetVehicles. */
export function easeOutQuad(t) {
  const x = Math.min(1, Math.max(0, Number(t) || 0));
  return x * (2 - x);
}

/**
 * Where the pin is right now mid-lerp (not the previous animation start).
 * Restarting from prev.lat alone rewound markers every HTTP poll.
 */
export function currentAnimatedPosition(prev, now = performance.now(), animMs = FLEET_MARKER_ANIM_MS) {
  if (!prev) return { lat: null, lng: null };
  const targetLat = Number(prev.targetLat);
  const targetLng = Number(prev.targetLng);
  const fromLat = Number.isFinite(prev.prevLat) ? Number(prev.prevLat) : Number(prev.lat);
  const fromLng = Number.isFinite(prev.prevLng) ? Number(prev.prevLng) : Number(prev.lng);
  if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng)) {
    return {
      lat: Number.isFinite(fromLat) ? fromLat : null,
      lng: Number.isFinite(fromLng) ? fromLng : null,
    };
  }
  if (!Number.isFinite(fromLat) || !Number.isFinite(fromLng)) {
    return { lat: targetLat, lng: targetLng };
  }
  const start = Number(prev.animStart);
  if (!Number.isFinite(start)) {
    return { lat: targetLat, lng: targetLng };
  }
  const t = easeOutQuad((now - start) / Math.max(1, animMs));
  return {
    lat: fromLat + (targetLat - fromLat) * t,
    lng: fromLng + (targetLng - fromLng) * t,
  };
}

export function parseVehicleTimestamp(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : 0;
}
