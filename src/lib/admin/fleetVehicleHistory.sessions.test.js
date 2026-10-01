/**
 * Lightweight assertions for GPS session segmentation (no vitest required).
 */
import { segmentGpsSessions, summarizeRoutePoints, pathLengthKm } from './fleetVehicleHistory.js';

const continuous = [
  { lat: 38.1, lng: 23.7, recorded_at: '2026-03-25T08:00:00.000Z', speed_kmh: 40 },
  { lat: 38.11, lng: 23.71, recorded_at: '2026-03-25T08:05:00.000Z', speed_kmh: 50 },
  { lat: 38.12, lng: 23.72, recorded_at: '2026-03-25T08:10:00.000Z', speed_kmh: 45 },
];
const one = segmentGpsSessions(continuous, { activeWithinMs: 0 });
console.assert(one.length === 1, 'continuous → 1 session');
console.assert(one[0].maxSpeed === 50, 'max speed captured');

const gapped = [
  { lat: 38.1, lng: 23.7, recorded_at: '2026-03-25T08:00:00.000Z', speed_kmh: 30 },
  { lat: 38.11, lng: 23.71, recorded_at: '2026-03-25T08:10:00.000Z', speed_kmh: 35 },
  { lat: 38.2, lng: 23.8, recorded_at: '2026-03-25T08:55:00.000Z', speed_kmh: 20 },
  { lat: 38.21, lng: 23.81, recorded_at: '2026-03-25T09:00:00.000Z', speed_kmh: 25 },
];
const two = segmentGpsSessions(gapped, { gapMs: 20 * 60 * 1000, activeWithinMs: 0 });
console.assert(two.length === 2, 'gap → 2 sessions');
console.assert(two[0].enteredAt === '2026-03-25T08:00:00.000Z', 'enter time');
console.assert(two[0].exitedAt === '2026-03-25T08:10:00.000Z', 'exit time');

const summary = summarizeRoutePoints(continuous);
console.assert(summary.maxSpeed === 50, 'summary max');
console.assert(pathLengthKm(continuous) > 0, 'path length');

console.log('fleetVehicleHistory.sessions.test.js: ok');
