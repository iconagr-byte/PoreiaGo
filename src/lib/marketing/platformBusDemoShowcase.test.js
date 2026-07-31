import assert from 'node:assert/strict';
import {
  DEMO_BUS_FLEET,
  getPlatformDemoBuses,
  getPlatformDemoTrips,
} from './platformBusDemoShowcase.js';

const buses = getPlatformDemoBuses(3);
assert.equal(buses.length, 3);
assert.equal(buses[0].id, DEMO_BUS_FLEET[0].id);
assert.ok(buses[0].name.includes('Mercedes') || buses[0].category);
assert.ok(!String(buses[0].name).toLowerCase().includes('aygo'));

const trips = getPlatformDemoTrips(3);
assert.equal(trips.length, 3);
assert.ok(trips.every((t) => t.title && t.id));
assert.equal(trips[0].market, 'domestic');

console.log('platformBusDemoShowcase: OK');
