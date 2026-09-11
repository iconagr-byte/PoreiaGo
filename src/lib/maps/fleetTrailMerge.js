/**
 * Pure helpers for live fleet GPS trail merge (no React).
 */

const EARTH_M = 6371000;

export function haversineM(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function normalizeServerTrail(raw) {
  if (!Array.isArray(raw) || !raw.length) return null;
  const points = [];
  for (const p of raw) {
    const lat = Number(p?.lat);
    const lng = Number(p?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    points.push({
      lat,
      lng,
      t: p.t || p.recorded_at || null,
      s: Number.isFinite(Number(p.s ?? p.speed_kmh)) ? Number(p.s ?? p.speed_kmh) : null,
      h: Number.isFinite(Number(p.h ?? p.heading_deg)) ? Number(p.h ?? p.heading_deg) : null,
    });
  }
  return points.length ? points : null;
}

/**
 * Merge Redis/server trail with local breadcrumbs + current live pin.
 * - Prefer the longer path as base (server when it has the full shift).
 * - Never wipe a longer local trail with a 1-point server stub.
 * - Always append the live pin when it moved ≥ minMoveM.
 */
export function mergeVehicleTrail(prev, serverPts, livePt, { maxPoints = 3000, minMoveM = 3 } = {}) {
  let pts = Array.isArray(prev) && prev.length ? prev.slice() : [];

  if (serverPts && serverPts.length > 1) {
    if (!pts.length || serverPts.length >= pts.length) {
      pts = serverPts.slice();
    }
  } else if (serverPts && serverPts.length === 1 && !pts.length) {
    pts = serverPts.slice();
  }

  const lat = Number(livePt?.lat);
  const lng = Number(livePt?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const tip = { lat, lng };
    if (!pts.length) {
      pts = [tip];
    } else if (haversineM(pts[pts.length - 1], tip) >= minMoveM) {
      pts.push(tip);
    }
  }

  if (pts.length > maxPoints) {
    pts = pts.slice(-maxPoints);
  }
  return pts;
}

export function sameTrailTip(a, b) {
  if (!a || !b) return false;
  return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
}
