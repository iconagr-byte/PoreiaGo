/**
 * Keep the live-map camera on the tracked pin so it never leaves the viewport.
 * One pin (or an explicit selection) is followed; many pins stay in view.
 */

export const FOLLOW_CENTER_MIN_METERS = 18;
export const FOLLOW_MOVING_KMH = 8;

export function haversineMeters(aLat, aLng, bLat, bLng) {
  const lat1 = Number(aLat);
  const lng1 = Number(aLng);
  const lat2 = Number(bLat);
  const lng2 = Number(bLng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function vehicleIdOf(v) {
  return String(v?.id || v?.vehicle_id || '').trim();
}

export function pickFollowTarget(vehicles, followId = null) {
  const pts = (vehicles || []).filter(
    (v) => Number.isFinite(Number(v?.lat)) && Number.isFinite(Number(v?.lng)),
  );
  if (!pts.length) return null;
  const want = String(followId || '').trim();
  if (want) {
    const hit = pts.find((v) => vehicleIdOf(v) === want);
    if (hit) return hit;
  }
  if (pts.length === 1) return pts[0];
  return null;
}

export function lngLatInPaddedBounds(lng, lat, box, padRatio = 0.1) {
  if (!box) return false;
  const west = Number(box.west);
  const south = Number(box.south);
  const east = Number(box.east);
  const north = Number(box.north);
  const x = Number(lng);
  const y = Number(lat);
  if (![west, south, east, north, x, y].every(Number.isFinite)) return false;
  const latPad = (north - south) * padRatio;
  const lngPad = (east - west) * padRatio;
  return x >= west + lngPad && x <= east - lngPad && y >= south + latPad && y <= north - latPad;
}

export function boundsBoxFromLeaflet(bounds) {
  if (!bounds?.getWest) return null;
  return {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
  };
}

export function boundsBoxFromMapbox(bounds) {
  if (!bounds?.getWest) return null;
  return {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
  };
}

/**
 * Pan the camera onto `target` unless the user is dragging.
 * Moving pins stay centered; parked pins only recapture if they left the view.
 */
export function shouldPanToFollowTarget({
  speedKmh,
  distanceFromCenterM,
  pinInView = true,
  dragging = false,
} = {}) {
  if (dragging) return false;
  if (!pinInView) return true;
  const moving = Number(speedKmh) >= FOLLOW_MOVING_KMH;
  if (moving) return Number(distanceFromCenterM) > FOLLOW_CENTER_MIN_METERS;
  return Number(distanceFromCenterM) > FOLLOW_CENTER_MIN_METERS * 4;
}
