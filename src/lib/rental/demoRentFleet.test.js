/**
 * Smoke: demo fleet only on platform marketing host, never on tenant offices.
 */
import assert from 'node:assert/strict';
import {
  DEMO_RENT_FLEET,
  isClientDemoFleet,
  isClientDemoFleetId,
  withDemoRentFleet,
} from './demoRentFleet.js';

const real = [{ id: 'office-1', model: 'Fiat 500', category: 'MINI' }];

assert.deepEqual(withDemoRentFleet(real, { hostname: 'www.poreiago.com' }), real);
assert.deepEqual(withDemoRentFleet(real, { hostname: 'www.achilliotravel.com' }), real);

const platformEmpty = withDemoRentFleet([], { hostname: 'www.poreiago.com' });
assert.equal(platformEmpty.length, DEMO_RENT_FLEET.length);
assert.ok(isClientDemoFleet(platformEmpty));

assert.deepEqual(withDemoRentFleet([], { hostname: 'poreiago.com' }), DEMO_RENT_FLEET);
assert.deepEqual(withDemoRentFleet([], { hostname: 'localhost' }), DEMO_RENT_FLEET);

assert.deepEqual(withDemoRentFleet([], { hostname: 'www.achilliotravel.com' }), []);
assert.deepEqual(withDemoRentFleet([], { hostname: 'achilliotravel.com' }), []);
assert.deepEqual(withDemoRentFleet([], { hostname: 'demo.poreiago.com' }), []);
assert.deepEqual(withDemoRentFleet([], { hostname: 'office.example.com' }), []);

assert.deepEqual(
  withDemoRentFleet([], { hostname: 'www.poreiago.com', allowShowcase: false }),
  [],
);

assert.equal(isClientDemoFleetId('demo-rent-car-i10'), true);
assert.equal(isClientDemoFleetId('demo-rent-van-vito'), true);
assert.equal(isClientDemoFleetId('office-van-1'), false);

console.log('demoRentFleet: OK');
