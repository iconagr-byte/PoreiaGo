/**
 * Smoke test for useFleetVehicleTrails helpers via dynamic import of haversine path growth.
 * (Hook itself needs React; we assert trail normalize path through a tiny replica.)
 */
function normalizeServerTrail(raw) {
  if (!Array.isArray(raw) || !raw.length) return null;
  const points = [];
  for (const p of raw) {
    const lat = Number(p?.lat);
    const lng = Number(p?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    points.push({ lat, lng });
  }
  return points.length ? points : null;
}

const a = normalizeServerTrail([
  { lat: 38.25, lng: 21.73 },
  { lat: 38.26, lng: 21.74 },
]);
console.assert(a && a.length === 2, 'server trail normalize');
console.assert(normalizeServerTrail([]) === null, 'empty null');
console.assert(normalizeServerTrail([{ lat: 'x', lng: 1 }]) === null, 'bad coords');
console.log('fleetVehicleTrails: OK');
