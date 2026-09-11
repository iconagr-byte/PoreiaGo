/**
 * Unit checks for live fleet trail merge / normalize helpers.
 */
import { haversineM, mergeVehicleTrail, normalizeServerTrail } from '../lib/maps/fleetTrailMerge.js';
import { sampleTrailBreadcrumbs } from '../lib/maps/trailBreadcrumbs.js';

const a = normalizeServerTrail([
  { lat: 38.25, lng: 21.73 },
  { lat: 38.26, lng: 21.74 },
]);
console.assert(a && a.length === 2, 'server trail normalize');
console.assert(normalizeServerTrail([]) === null, 'empty null');
console.assert(normalizeServerTrail([{ lat: 'x', lng: 1 }]) === null, 'bad coords');

// 1-point server stub must not wipe a longer local path; live pin still appends.
const local = [
  { lat: 38.25, lng: 21.73 },
  { lat: 38.251, lng: 21.731 },
  { lat: 38.252, lng: 21.732 },
];
const stub = [{ lat: 38.252, lng: 21.732 }];
const mergedStub = mergeVehicleTrail(local, stub, { lat: 38.26, lng: 21.74 }, { minMoveM: 3 });
console.assert(mergedStub.length >= 4, 'local path survives 1-point server stub + live append');
console.assert(
  Math.abs(mergedStub[mergedStub.length - 1].lat - 38.26) < 1e-9,
  'live tip appended after stub',
);

// Longer server trail replaces shorter local base, then live tip can append.
const server = [
  { lat: 38.24, lng: 21.72 },
  { lat: 38.25, lng: 21.73 },
  { lat: 38.26, lng: 21.74 },
  { lat: 38.27, lng: 21.75 },
];
const mergedServer = mergeVehicleTrail([{ lat: 38.25, lng: 21.73 }], server, { lat: 38.27, lng: 21.75 }, {
  minMoveM: 3,
});
console.assert(mergedServer.length >= 4, 'longer server trail preferred');
console.assert(Math.abs(mergedServer[0].lat - 38.24) < 1e-9, 'server start kept');

console.assert(haversineM({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }) === 0, 'haversine zero');
console.assert(sampleTrailBreadcrumbs([[1, 2], [3, 4], [5, 6]], 80).length === 3, 'crumbs passthrough');
console.assert(sampleTrailBreadcrumbs(Array.from({ length: 200 }, (_, i) => [i, i]), 72).length === 72, 'crumbs capped');

console.log('fleetVehicleTrails: OK');
