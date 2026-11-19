/**
 * Smoke: trip details has no live-tracking map (desktop + native wallet share this page).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'TripDetails.jsx'), 'utf8');

console.assert(!src.includes('react-leaflet'), 'no leaflet map');
console.assert(!src.includes('MapContainer'), 'no MapContainer');
console.assert(!src.includes('Live Tracking'), 'no Live Tracking control');
console.assert(!src.includes('isLiveTracking'), 'no live-tracking state');
console.assert(src.includes('Στάσεις'), 'stop list remains');

console.log('TripDetails.test.js: ok');
