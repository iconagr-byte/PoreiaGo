import assert from 'node:assert/strict';
import { mockTrips } from '../../data/mockData.js';
import { DEMO_RENT_FLEET } from '../rental/demoRentFleet.js';
import {
  getPlatformDemoFleetPreview,
  getPlatformDemoTripPreview,
  PLATFORM_DEMO_COPY,
} from './platformDemoShowcase.js';

const fleet = getPlatformDemoFleetPreview(3);
assert.equal(fleet.length, 3);
assert.equal(fleet[0].title, DEMO_RENT_FLEET[0].model);
assert.ok(fleet[0].href.includes('/rent'));

const trips = getPlatformDemoTripPreview(3);
assert.equal(trips.length, 3);
assert.ok(trips.every((t) => t.href.startsWith('/trip/')));
assert.ok(mockTrips.some((m) => m.title === trips[0].title));
assert.ok(PLATFORM_DEMO_COPY.fleetTitle.includes('Στόλος'));
assert.ok(PLATFORM_DEMO_COPY.tripsTitle.includes('Εκδρομές'));

console.log('platformDemoShowcase.test.js: ok');
